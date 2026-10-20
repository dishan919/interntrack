import assert from 'node:assert/strict'
import { before, after, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import app from '../src/app.js'
import User from '../src/models/User.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'
import { setTestResetCapture, deliverPasswordReset } from '../src/services/passwordResetDelivery.js'
import { RESET_REQUEST_MESSAGE, INVALID_RESET_MESSAGE, RESET_TTL_MS } from '../src/controllers/passwordResetController.js'
let database, server, base, delivery
const originalEnv = process.env.NODE_ENV
const originalSecret = process.env.JWT_SECRET
const account = { name: 'Reset User', email: 'reset@example.com', password: 'OriginalPassword123' }
const newPassword = ' ReplacementPassword456 '
const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'disposable-reset-tests-secret'
  setTestResetCapture(details => { delivery = details })
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}/api/auth/`
})
beforeEach(async () => { delivery = undefined; await User.deleteMany({}); await User.create(account) })
after(async () => {
  setTestResetCapture(undefined)
  if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret
  if (server) await new Promise(resolve => server.close(resolve))
  await disconnectDatabase()
  if (database) await database.stop()
})
async function request() {
  const response = await post('forgot-password', { email: ' RESET@Example.COM ' })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { message: RESET_REQUEST_MESSAGE })
  return delivery.token
}
test('generic known/unknown response, normalized email, random hashed temporary token and safe serialization', async () => {
  const token = await request()
  assert.match(token, /^[a-f0-9]{64}$/)
  const stored = await User.collection.findOne({ email: account.email })
  assert.equal(stored.passwordResetTokenHash, createHash('sha256').update(token).digest('hex'))
  assert.ok(!JSON.stringify(stored).includes(token))
  assert.ok(stored.passwordResetExpiresAt > new Date())
  assert.ok(stored.passwordResetExpiresAt <= new Date(Date.now() + RESET_TTL_MS))
  const selected = await User.findOne().select('+password +passwordResetTokenHash +passwordResetExpiresAt')
  for (const key of ['password', 'passwordResetTokenHash', 'passwordResetExpiresAt']) {
    assert.equal(selected.toJSON()[key], undefined)
    assert.equal((await User.findOne())[key], undefined)
  }
  delivery = undefined
  const unknown = await post('forgot-password', { email: 'unknown@example.com' })
  assert.equal(unknown.status, 200)
  assert.deepEqual(await unknown.json(), { message: RESET_REQUEST_MESSAGE })
  assert.equal(delivery, undefined)
  assert.equal(await User.countDocuments(), 1)
  const login = await (await post('login', account)).json()
  assert.deepEqual(Object.keys(login.user).sort(), ['email', 'emailVerified', 'id', 'name'])
  const me = await fetch(base + 'me', { headers: { Authorization: `Bearer ${login.accessToken}` } })
  assert.deepEqual(Object.keys((await me.json()).user).sort(), ['email', 'emailVerified', 'id', 'name'])
})
test('valid reset hashes once, clears token, requires explicit login and rejects reuse', async () => {
  const token = await request()
  const response = await post('reset-password', { token, newPassword })
  assert.equal(response.status, 200)
  assert.deepEqual(Object.keys(await response.json()), ['message'])
  const stored = await User.collection.findOne()
  assert.equal(bcrypt.getRounds(stored.password), 12)
  assert.ok(await bcrypt.compare(newPassword, stored.password))
  assert.equal(stored.passwordResetTokenHash, undefined)
  assert.equal(stored.passwordResetExpiresAt, undefined)
  assert.equal((await post('login', account)).status, 401)
  assert.equal((await post('login', { email: account.email, password: newPassword })).status, 200)
  assert.equal((await post('reset-password', { token, newPassword })).status, 400)
})
test('invalid, expired and replaced tokens rejected; latest token works', async () => {
  const first = await request()
  const second = await request()
  assert.notEqual(first, second)
  for (const token of [first, 'a'.repeat(64), '', {}, null]) {
    const response = await post('reset-password', { token, newPassword })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { message: INVALID_RESET_MESSAGE })
  }
  await User.updateOne({}, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1) } })
  assert.equal((await post('reset-password', { token: second, newPassword })).status, 400)
  const latest = await request()
  assert.equal((await post('reset-password', { token: latest, newPassword })).status, 200)
})
test('invalid password and userId authority rejected without consuming token', async () => {
  const token = await request()
  for (const value of ['short', ' '.repeat(8), {}, null, 'x'.repeat(73), '\u00e9'.repeat(37)]) {
    assert.equal((await post('reset-password', { token, newPassword: value })).status, 400)
  }
  const other = await User.create({ ...account, email: 'other@example.com' })
  const before = await User.collection.findOne({ _id: other._id })
  assert.equal((await post('reset-password', { token, newPassword, userId: other.id })).status, 400)
  assert.equal((await post('reset-password', { userId: other.id, newPassword })).status, 400)
  assert.deepEqual(await User.collection.findOne({ _id: other._id }), before)
  assert.equal((await post('reset-password', { token, newPassword })).status, 200)
})
test('concurrent reset consumes the token exactly once', async () => {
  const token = await request()
  const responses = await Promise.all([post('reset-password', { token, newPassword }), post('reset-password', { token, newPassword: 'AnotherPassword789' })])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 400])
})
test('production cannot configure or invoke test capture and never exposes token', async () => {
  process.env.NODE_ENV = 'production'
  try {
    assert.throws(() => setTestResetCapture(() => {}), /test-only/)
    await deliverPasswordReset({ token: 'private' })
    assert.equal(delivery, undefined)
    const response = await post('forgot-password', { email: account.email })
    assert.deepEqual(await response.json(), { message: RESET_REQUEST_MESSAGE })
    assert.equal(delivery, undefined)
  } finally { process.env.NODE_ENV = 'test' }
})
