import assert from 'node:assert/strict'
import { before, after, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import app from '../src/app.js'
import User from '../src/models/User.js'
import Application from '../src/models/Application.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'

let database, server, base, a, b, tokenA, tokenB
const originalSecret = process.env.JWT_SECRET
const secret = 'disposable-account-deletion-tests-secret'
const password = ' CurrentPassword123 '
const application = { company: 'Private A', position: 'Intern' }
const tokenFor = user => jwt.sign({ sub: user.id }, secret, { expiresIn: '1h' })
const request = (path, method = 'GET', body, token = tokenA) => fetch(base + path, {
  method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const remove = (body = { currentPassword: password }, token = tokenA) => request('auth/me', 'DELETE', body, token)
before(async () => {
  process.env.JWT_SECRET = secret
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}/api/`
})
beforeEach(async () => {
  await Application.deleteMany({})
  await User.deleteMany({})
  a = await User.create({ name: 'User A', email: 'a@example.com', password,
    passwordResetTokenHash: 'reset-hash-a', passwordResetExpiresAt: new Date(Date.now() + 60000),
    emailVerified: false, emailVerificationTokenHash: 'verify-hash-a', emailVerificationExpiresAt: new Date(Date.now() + 60000) })
  b = await User.create({ name: 'User B', email: 'b@example.com', password: 'OtherPassword456', emailVerified: true })
  tokenA = tokenFor(a); tokenB = tokenFor(b)
  await Application.create([{ ...application, owner: a.id }, { ...application, company: 'Private A2', owner: a.id }, { ...application, company: 'Private B', owner: b.id }])
})
after(async () => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret
  if (server) await new Promise(resolve => server.close(resolve))
  await disconnectDatabase()
  if (database) await database.stop()
})
async function snapshot() {
  return { users: await User.collection.find({}).sort({ _id: 1 }).toArray(), applications: await Application.collection.find({}).sort({ _id: 1 }).toArray() }
}
test('deletion requires JWT, rejecting missing, invalid and expired tokens before cleanup', async () => {
  const before = await snapshot()
  for (const token of [null, 'invalid', jwt.sign({ sub: a.id }, secret, { expiresIn: -1 })]) {
    const response = await remove(undefined, token)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Unauthorized' })
  }
  assert.deepEqual(await snapshot(), before)
})
test('missing/invalid/blank passwords and malformed bodies do not alter any records', async () => {
  const before = await snapshot()
  for (const body of [{}, { currentPassword: '' }, { currentPassword: '   ' }, { currentPassword: {} }, { currentPassword: null }, [], null]) {
    assert.equal((await remove(body)).status, 400)
    assert.deepEqual(await snapshot(), before)
  }
  assert.equal((await request('auth/me', 'DELETE')).status, 400)
  assert.deepEqual(await snapshot(), before)
})
test('wrong and whitespace-trimmed passwords do not delete users or applications', async () => {
  const before = await snapshot()
  for (const currentPassword of ['WrongPassword123', password.trim(), 'OtherPassword456']) {
    const response = await remove({ currentPassword })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { message: 'Current password is incorrect.' })
    assert.deepEqual(await snapshot(), before)
  }
})
test('bcrypt truncation cannot authenticate a longer password with a matching 72-byte prefix', async () => {
  a.password = 'x'.repeat(72)
  await a.save()
  const before = await snapshot()
  assert.equal((await remove({ currentPassword: 'x'.repeat(73) })).status, 400)
  assert.deepEqual(await snapshot(), before)
  assert.equal((await remove({ currentPassword: 'x'.repeat(72) })).status, 200)
})
test('correct reauthentication deletes only A and A1/A2, preserving B/B1 and ownerless legacy data', async () => {
  const beforeB = await User.collection.findOne({ _id: b._id })
  const beforeB1 = await Application.collection.findOne({ owner: b._id })
  const legacy = await Application.collection.insertOne({ company: 'Legacy', position: 'Intern' })
  const response = await remove()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { message: 'Account deleted successfully.' })
  assert.equal(await User.findById(a.id), null)
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
  assert.deepEqual(await User.collection.findOne({ _id: b._id }), beforeB)
  assert.deepEqual(await Application.collection.findOne({ owner: b._id }), beforeB1)
  assert.ok(await Application.collection.findOne({ _id: legacy.insertedId }))
  assert.equal((await request('auth/login', 'POST', { email: a.email, password }, null)).status, 401)
  assert.equal((await request('auth/me')).status, 401)
  assert.equal((await remove()).status, 401)
  assert.equal((await request('auth/login', 'POST', { email: b.email, password: 'OtherPassword456' }, null)).status, 200)
  assert.equal((await request('auth/me', 'GET', undefined, tokenB)).status, 200)
  assert.equal((await (await request('applications', 'GET', undefined, tokenB)).json()).length, 1)
})
test('identity, reset and verification payload fields cannot redirect or authorize deletion', async () => {
  const before = await snapshot()
  for (const key of ['userId', 'id', '_id', 'email', 'owner', 'password', 'emailVerified', 'passwordResetTokenHash', 'passwordResetExpiresAt', 'emailVerificationTokenHash', 'emailVerificationExpiresAt', 'token', '$where']) {
    const response = await remove({ currentPassword: password, [key]: key === 'email' ? b.email : b.id })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { message: 'Invalid account deletion data' })
    assert.deepEqual(await snapshot(), before)
  }
  const response = await request(`auth/me?userId=${b.id}&id=${b.id}&email=${b.email}`, 'DELETE', { currentPassword: password })
  assert.equal(response.status, 200)
  assert.equal(await User.findById(a.id), null)
  assert.ok(await User.findById(b.id))
})
test('old JWT cannot read/create/update/delete application data after deletion', async () => {
  const owned = await Application.findOne({ owner: a.id })
  assert.equal((await remove()).status, 200)
  for (const [method, path, body] of [['GET', 'applications'], ['GET', `applications/${owned.id}`], ['POST', 'applications', application], ['PUT', `applications/${owned.id}`, application], ['DELETE', `applications/${owned.id}`]]) {
    const response = await request(path, method, body)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Unauthorized' })
  }
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
  assert.equal((await request('auth/me', 'PATCH', { name: 'Resurrect' })).status, 401)
  assert.equal((await request('auth/password', 'PATCH', { currentPassword: password, newPassword: 'ChangedPassword789' })).status, 401)
  assert.equal((await request('auth/resend-verification', 'POST', {})).status, 401)
})
test('cleanup failure keeps user and safe error; retry releases queue and succeeds', async t => {
  const before = await snapshot()
  const mock = t.mock.method(Application, 'deleteMany', async () => { throw new Error('private database cleanup diagnostic') })
  const response = await remove()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
  assert.deepEqual(await snapshot(), before)
  mock.mock.restore()
  assert.equal((await remove()).status, 200)
})
test('user-delete failure is not reported as success; account retained after applications-first cleanup', async t => {
  const beforeB = await Application.collection.findOne({ owner: b._id })
  const mock = t.mock.method(User, 'deleteOne', async () => { throw new Error('private user delete diagnostic') })
  const response = await remove()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
  assert.ok(await User.findById(a.id))
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
  assert.deepEqual(await Application.collection.findOne({ owner: b._id }), beforeB)
  mock.mock.restore()
  assert.equal((await remove()).status, 200)
})
test('concurrent deletions cannot consume a missing account or escape owner isolation', async () => {
  const results = await Promise.all([remove(), remove()])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 401])
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
  assert.ok(await User.findById(b.id))
})
test('application creation already in flight completes before deletion and is cleaned', async t => {
  let release, started
  const entered = new Promise(resolve => { started = resolve })
  const proceed = new Promise(resolve => { release = resolve })
  const create = Application.create.bind(Application)
  t.mock.method(Application, 'create', async (...args) => { started(); await proceed; return create(...args) })
  const creating = request('applications', 'POST', application)
  await entered
  const deleting = remove()
  release()
  assert.equal((await creating).status, 201)
  assert.equal((await deleting).status, 200)
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
})
test('application creation waiting behind deletion rechecks existence and cannot recreate data', async t => {
  let release, started
  const entered = new Promise(resolve => { started = resolve })
  const proceed = new Promise(resolve => { release = resolve })
  const cleanup = Application.deleteMany.bind(Application)
  t.mock.method(Application, 'deleteMany', async (...args) => { started(); await proceed; return cleanup(...args) })
  const deleting = remove()
  await entered
  const creating = request('applications', 'POST', application)
  assert.equal((await request('applications', 'POST', { ...application, company: 'Other B2' }, tokenB)).status, 201, 'Another account is not blocked by A deletion')
  release()
  assert.equal((await deleting).status, 200)
  assert.equal((await creating).status, 401)
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
})
test('password changed during deletion cannot authorize final removal with a stale hash', async t => {
  const cleanup = Application.deleteMany.bind(Application)
  t.mock.method(Application, 'deleteMany', async (...args) => {
    await User.updateOne({ _id: a.id }, { $set: { password: await bcrypt.hash('ChangedDuringDeletion789', 12) } })
    return cleanup(...args)
  })
  const response = await remove()
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { message: 'Account changed. Please sign in again and retry.' })
  assert.ok(await User.findById(a.id))
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
})
