import assert from 'node:assert/strict'
import { before, after, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import jwt from 'jsonwebtoken'
import app from '../src/app.js'
import User from '../src/models/User.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'
import { setTestVerificationCapture, deliverEmailVerification, VERIFICATION_TTL_MS, INVALID_VERIFICATION_MESSAGE, VERIFIED_MESSAGE, RESENT_MESSAGE, ALREADY_VERIFIED_MESSAGE } from '../src/services/emailVerification.js'
let database, server, base, deliveries
const originalEnv = process.env.NODE_ENV
const originalSecret = process.env.JWT_SECRET
const secret = 'disposable-verification-tests-secret'
const account = { name: 'Verify User', email: 'verify@example.com', password: 'OriginalPassword123' }
const post = (path, body = {}, token) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
const getMe = token => fetch(base + 'me', { headers: { Authorization: `Bearer ${token}` } })
const patch = (token, body) => fetch(base + 'me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = secret
  setTestVerificationCapture(details => deliveries.push(details))
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}/api/auth/`
})
beforeEach(async () => { deliveries = []; await User.deleteMany({}) })
after(async () => {
  setTestVerificationCapture(undefined)
  if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret
  if (server) await new Promise(resolve => server.close(resolve))
  await disconnectDatabase()
  if (database) await database.stop()
})
async function register() {
  const response = await post('register', { ...account, emailVerified: true, emailVerificationTokenHash: 'forged' })
  assert.equal(response.status, 201)
  const { user } = await response.json()
  assert.equal(user.emailVerified, false)
  assert.deepEqual(Object.keys(user).sort(), ['email', 'emailVerified', 'id', 'name'])
  return user
}
const authToken = user => jwt.sign({ sub: user.id }, secret, { expiresIn: '1h' })
const verify = token => post('verify-email', { token })
async function assertInvalid(token) {
  const response = await verify(token)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: INVALID_VERIFICATION_MESSAGE })
}
test('registration persists random hash and 24h expiry; unverified login/me and secret filtering work', async () => {
  const user = await register()
  assert.equal(deliveries.length, 1)
  const { token, email, expiresAt } = deliveries[0]
  assert.equal(email, account.email)
  assert.match(token, /^[a-f0-9]{64}$/)
  const stored = await User.collection.findOne()
  assert.equal(stored.emailVerified, false)
  assert.equal(stored.emailVerificationTokenHash, createHash('sha256').update(token).digest('hex'))
  assert.ok(!JSON.stringify(stored).includes(token))
  assert.ok(expiresAt > new Date())
  assert.ok(expiresAt <= new Date(Date.now() + VERIFICATION_TTL_MS))
  assert.equal(stored.emailVerificationExpiresAt.getTime(), expiresAt.getTime())
  const login = await post('login', account)
  assert.equal(login.status, 200)
  const body = await login.json()
  assert.deepEqual(body.user, user)
  assert.deepEqual(await (await getMe(body.accessToken)).json(), { user })
  const selected = await User.findOne().select('+password +emailVerificationTokenHash +emailVerificationExpiresAt')
  for (const key of ['password', 'emailVerificationTokenHash', 'emailVerificationExpiresAt']) {
    assert.equal((await User.findOne())[key], undefined)
    assert.equal(selected.toJSON()[key], undefined)
    assert.equal(body.user[key], undefined)
  }
})
test('verification is atomic, clears secrets, returns safe message and cannot be reused', async () => {
  const user = await register()
  const token = deliveries[0].token
  const responses = await Promise.all([verify(token), verify(token)])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 400])
  assert.deepEqual(await responses.find(response => response.status === 200).json(), { message: VERIFIED_MESSAGE })
  const stored = await User.collection.findOne()
  assert.equal(stored.emailVerified, true)
  assert.equal(stored.emailVerificationTokenHash, undefined)
  assert.equal(stored.emailVerificationExpiresAt, undefined)
  await assertInvalid(token)
  assert.equal((await (await getMe(authToken(user))).json()).user.emailVerified, true)
  assert.equal((await (await post('login', account)).json()).user.emailVerified, true)
})
test('invalid, expired, missing and malformed tokens rejected without account details', async () => {
  await register()
  for (const token of ['a'.repeat(64), '', {}, null, ['a'.repeat(64)]]) await assertInvalid(token)
  await User.updateOne({}, { $set: { emailVerificationExpiresAt: new Date(Date.now() - 1) } })
  await assertInvalid(deliveries[0].token)
  assert.equal((await User.findOne()).emailVerified, false)
  assert.equal((await post('verify-email', { token: deliveries[0].token, userId: 'spoofed' })).status, 400)
})
test('resend requires JWT, rejects spoofing, replaces old tokens and skips verified accounts', async () => {
  const user = await register()
  const other = await User.create({ ...account, email: 'other@example.com' })
  const otherBefore = await User.collection.findOne({ _id: other._id })
  for (const token of [undefined, 'invalid', jwt.sign({ sub: user.id }, secret, { expiresIn: -1 })]) assert.equal((await post('resend-verification', {}, token)).status, 401)
  assert.equal((await post('resend-verification', { userId: other.id }, authToken(user))).status, 400)
  assert.deepEqual(await User.collection.findOne({ _id: other._id }), otherBefore)
  const old = deliveries[0].token
  const response = await post('resend-verification', {}, authToken(user))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { message: RESENT_MESSAGE })
  assert.equal(deliveries.length, 2)
  assert.notEqual(deliveries[1].token, old)
  assert.ok(deliveries[1].expiresAt >= deliveries[0].expiresAt)
  await assertInvalid(old)
  assert.equal((await verify(deliveries[1].token)).status, 200)
  const before = await User.collection.findOne({ email: account.email })
  const verified = await post('resend-verification', {}, authToken(user))
  assert.deepEqual(await verified.json(), { message: ALREADY_VERIFIED_MESSAGE })
  assert.equal(deliveries.length, 2)
  assert.deepEqual(await User.collection.findOne({ email: account.email }), before)
})
test('profile cannot self-verify; name/same email preserve status; changed email requires fresh token', async () => {
  const user = await register()
  const jwtToken = authToken(user)
  for (const body of [{ emailVerified: true }, { emailVerificationTokenHash: 'forged' }, { emailVerificationExpiresAt: new Date() }]) assert.equal((await patch(jwtToken, body)).status, 400)
  let response = await patch(jwtToken, { name: 'Safe Name', emailVerified: true, emailVerificationTokenHash: 'forged' })
  assert.equal((await response.json()).user.emailVerified, false)
  const oldToken = deliveries[0].token
  await verify(oldToken)
  response = await patch(jwtToken, { name: 'Verified Name' })
  assert.equal((await response.json()).user.emailVerified, true)
  response = await patch(jwtToken, { email: ' VERIFY@Example.COM ' })
  assert.equal((await response.json()).user.emailVerified, true)
  assert.equal(deliveries.length, 1)
  response = await patch(jwtToken, { email: ' NEW@Example.COM ', emailVerified: true })
  const changed = (await response.json()).user
  assert.equal(changed.email, 'new@example.com')
  assert.equal(changed.emailVerified, false)
  assert.deepEqual(Object.keys(changed).sort(), ['email', 'emailVerified', 'id', 'name'])
  assert.equal(deliveries.at(-1).email, changed.email)
  assert.equal(deliveries.length, 2)
  await assertInvalid(oldToken)
  const pending = deliveries.at(-1).token
  await patch(jwtToken, { email: 'latest@example.com' })
  await assertInvalid(pending)
  assert.equal((await verify(deliveries.at(-1).token)).status, 200)
  assert.equal((await (await getMe(jwtToken)).json()).user.emailVerified, true)
})
test('legacy missing status remains usable without rewriting records', async () => {
  const created = await User.create(account)
  await User.collection.updateOne({ _id: created._id }, { $unset: { emailVerified: '' } })
  const before = await User.collection.findOne()
  const response = await post('login', account)
  assert.equal(response.status, 200)
  const { user, accessToken } = await response.json()
  assert.equal(user.emailVerified, false)
  assert.equal((await (await getMe(accessToken)).json()).user.emailVerified, false)
  assert.deepEqual(await User.collection.findOne(), before)
  assert.equal((await post('resend-verification', {}, accessToken)).status, 200)
  assert.equal((await verify(deliveries[0].token)).status, 200)
})
test('production capture unavailable and public responses never expose secrets', async () => {
  process.env.NODE_ENV = 'production'
  try {
    assert.throws(() => setTestVerificationCapture(() => {}), /test-only/)
    await deliverEmailVerification({ token: 'private' })
    const user = await register()
    assert.equal(deliveries.length, 0)
    const response = await post('resend-verification', {}, authToken(user))
    assert.deepEqual(await response.json(), { message: RESENT_MESSAGE })
    assert.equal(deliveries.length, 0)
  } finally { process.env.NODE_ENV = 'test' }
})
test('duplicate email failure preserves verification and sends no delivery', async () => {
  const user = await register()
  await verify(deliveries[0].token)
  await User.create({ ...account, email: 'taken@example.com' })
  const before = await User.collection.findOne({ email: account.email })
  const response = await patch(authToken(user), { name: 'Must not save', email: 'taken@example.com' })
  assert.equal(response.status, 409)
  assert.deepEqual(await User.collection.findOne({ email: account.email }), before)
  assert.equal(deliveries.length, 1)
})

test('email change racing verification cannot verify the new email with the old token', async () => {
  const user = await register()
  const token = deliveries[0].token
  const responses = await Promise.all([verify(token), patch(authToken(user), { email: 'racing@example.com' })])
  assert.ok([200, 400].includes(responses[0].status))
  assert.equal(responses[1].status, 200)
  const stored = await User.collection.findOne()
  assert.equal(stored.email, 'racing@example.com')
  assert.equal(stored.emailVerified, false)
  await assertInvalid(token)
  assert.equal((await verify(deliveries.at(-1).token)).status, 200)
})
test('resend racing verification never downgrades an account after consuming the current token', async () => {
  const user = await register()
  const token = deliveries[0].token
  const responses = await Promise.all([verify(token), post('resend-verification', {}, authToken(user))])
  assert.equal(responses[1].status, 200)
  const stored = await User.collection.findOne()
  if (responses[0].status === 200) {
    assert.equal(stored.emailVerified, true)
    assert.equal(stored.emailVerificationTokenHash, undefined)
  } else {
    assert.equal(responses[0].status, 400)
    assert.equal(stored.emailVerified, false)
    assert.equal((await verify(deliveries.at(-1).token)).status, 200)
  }
})
test('deleted resend user and database errors have safe responses', async t => {
  const user = await register()
  await User.deleteMany({})
  assert.equal((await post('resend-verification', {}, authToken(user))).status, 401)
  t.mock.method(User, 'findOneAndUpdate', () => { throw new Error('private database diagnostic') })
  const response = await verify(deliveries[0].token)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
})
