import assert from 'node:assert/strict'
import { before, after, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { isIP } from 'node:net'
import jwt from 'jsonwebtoken'
import app from '../src/app.js'
import User from '../src/models/User.js'
import LoginActivity, { MAX_USER_AGENT_LENGTH } from '../src/models/LoginActivity.js'
import Application from '../src/models/Application.js'
import { recordSuccessfulLogin, RECENT_LOGIN_ACTIVITY_LIMIT } from '../src/services/loginActivity.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'

let database, server, base, a, b, tokenA, tokenB
const originalSecret = process.env.JWT_SECRET
const secret = 'disposable-login-history-tests-secret'
const credentials = { email: 'a@example.com', password: 'HistoryPassword123' }
const agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
const tokenFor = user => jwt.sign({ sub: user.id }, secret, { expiresIn: '1h' })
const login = (body = credentials, headers = {}) => fetch(base + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': agent, ...headers }, body: JSON.stringify(body) })
const history = (token = tokenA, suffix = '') => fetch(base + 'login-activity' + suffix, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
const remove = () => fetch(base + 'me', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` }, body: JSON.stringify({ currentPassword: credentials.password }) })
before(async () => {
  process.env.JWT_SECRET = secret
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}/api/auth/`
})
beforeEach(async () => {
  await LoginActivity.deleteMany({}); await Application.deleteMany({}); await User.deleteMany({})
  a = await User.create({ name: 'History A', ...credentials })
  b = await User.create({ name: 'History B', email: 'b@example.com', password: 'OtherPassword456' })
  tokenA = tokenFor(a); tokenB = tokenFor(b)
})
after(async () => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret
  if (server) await new Promise(resolve => server.close(resolve))
  await disconnectDatabase()
  if (database) await database.stop()
})
const seed = (user, loggedInAt, userAgent = agent) => LoginActivity.create({ user, loggedInAt, ipAddress: '192.0.2.1', userAgent })
test('schema uses ObjectId User relationship and compound recent-history index', async () => {
  const user = LoginActivity.schema.path('user')
  assert.equal(user.instance, 'ObjectId')
  assert.equal(user.options.ref, 'User')
  assert.equal(user.options.required, true)
  assert.ok(LoginActivity.schema.indexes().some(([keys]) => keys.user === 1 && keys.loggedInAt === -1 && keys._id === -1))
  await assert.rejects(LoginActivity.create({ userAgent: agent }), error => error.errors.user.kind === 'required')
})
test('successful login records only server metadata and preserves existing safe login response', async () => {
  const before = Date.now()
  const response = await login({ ...credentials, userId: b.id, ipAddress: '203.0.113.9', userAgent: 'fake JSON agent', token: 'body-private-token' }, {
    'X-Forwarded-For': '198.51.100.9', Authorization: 'Bearer private-header-token', Cookie: 'session=private-cookie',
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(Object.keys(body).sort(), ['accessToken', 'user'])
  assert.equal(body.user.id, a.id)
  assert.equal(body.user.emailVerified, false)
  const stored = await LoginActivity.collection.findOne()
  assert.equal(stored.user.toString(), a.id)
  assert.equal(stored.userAgent, agent)
  assert.ok(isIP(stored.ipAddress))
  assert.ok(['127.0.0.1', '::ffff:127.0.0.1'].includes(stored.ipAddress))
  assert.ok(stored.loggedInAt.getTime() >= before && stored.loggedInAt <= new Date())
  assert.deepEqual(Object.keys(stored).sort(), ['_id', 'ipAddress', 'loggedInAt', 'user', 'userAgent'])
  for (const value of [credentials.password, body.accessToken, secret, 'body-private-token', 'private-header-token', 'private-cookie', 'fake JSON agent', '203.0.113.9', '198.51.100.9']) assert.ok(!JSON.stringify(stored).includes(value))
  assert.equal((await User.findById(a.id)).emailVerified, false, 'Unverified login remains allowed')
})
test('wrong password, unknown email, malformed credentials and configuration failure do not record successful history', async () => {
  for (const body of [{ ...credentials, password: 'WrongPassword123' }, { ...credentials, email: 'unknown@example.com' }, { ...credentials, password: {} }, { ...credentials, email: 'invalid' }]) assert.ok((await login(body)).status >= 400)
  delete process.env.JWT_SECRET
  try { assert.equal((await login()).status, 503) } finally { process.env.JWT_SECRET = secret }
  assert.equal(await LoginActivity.countDocuments(), 0)
})
test('audit write failure is best effort and emits only a fixed safe warning', async t => {
  const warning = t.mock.method(console, 'warn', () => {})
  t.mock.method(LoginActivity, 'create', async () => { throw new Error('private database/password/token diagnostic') })
  const response = await login()
  assert.equal(response.status, 200)
  const { user, accessToken } = await response.json()
  assert.equal(user.id, a.id)
  assert.equal(jwt.verify(accessToken, secret).sub, a.id)
  assert.equal(await LoginActivity.countDocuments(), 0)
  assert.equal(warning.mock.callCount(), 1)
  assert.deepEqual(warning.mock.calls[0].arguments, ['Login activity could not be recorded.'])
})
test('metadata is bounded and control-stripped with safe empty fallbacks', async () => {
  await recordSuccessfulLogin(a.id, { ip: 'untrusted-not-an-ip', get: () => '  Browser\u0000\n' + 'x'.repeat(900) })
  let stored = await LoginActivity.findOne()
  assert.equal(stored.ipAddress, '')
  assert.equal(stored.userAgent.length, MAX_USER_AGENT_LENGTH)
  assert.ok(!stored.userAgent.includes('\u0000'))
  assert.ok(!stored.userAgent.includes('\n'))
  await LoginActivity.deleteMany({})
  await recordSuccessfulLogin(a.id, { ip: undefined, get: () => undefined })
  stored = await LoginActivity.findOne()
  assert.equal(stored.ipAddress, '')
  assert.equal(stored.userAgent, '')
})
test('activity endpoint requires valid JWT and rejects a deleted user', async () => {
  await seed(a.id, new Date())
  for (const token of [null, 'invalid', jwt.sign({ sub: a.id }, secret, { expiresIn: -1 })]) {
    const response = await history(token)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Unauthorized' })
  }
  await User.deleteOne({ _id: a.id })
  assert.equal((await history()).status, 401)
})
test('A/B isolation, newest-first ordering, stable ties, configured bound and safe response', async () => {
  const time = Date.parse('2026-10-01T00:00:00Z')
  const entries = []
  for (let index = 0; index < RECENT_LOGIN_ACTIVITY_LIMIT + 5; index++) entries.push(await seed(a.id, new Date(time + index * 1000)))
  await seed(b.id, new Date(time + 100000), 'Private B Agent')
  const response = await history(tokenA, `?userId=${b.id}&user=${b.id}&limit=99999`)
  assert.equal(response.status, 200)
  const { activities } = await response.json()
  assert.equal(activities.length, RECENT_LOGIN_ACTIVITY_LIMIT)
  assert.deepEqual(activities.map(item => item.id), entries.slice(-RECENT_LOGIN_ACTIVITY_LIMIT).reverse().map(item => item.id))
  for (const item of activities) assert.deepEqual(Object.keys(item).sort(), ['id', 'ipAddress', 'loggedInAt', 'userAgent'])
  const other = await (await history(tokenB)).json()
  assert.equal(other.activities.length, 1)
  assert.equal(other.activities[0].userAgent, 'Private B Agent')
  assert.ok(!JSON.stringify(activities).includes('Private B Agent'))
  const tie1 = await seed(a.id, new Date(time + 200000))
  const tie2 = await seed(a.id, tie1.loggedInAt)
  assert.deepEqual((await (await history()).json()).activities.slice(0, 2).map(item => item.id), [tie2.id, tie1.id])
  const selected = await LoginActivity.findOne({ user: a.id })
  assert.equal(selected.toJSON().user, undefined)
  // GET bodies are possible over HTTP even though browser fetch disallows them.
  const bodyResult = await new Promise((resolve, reject) => {
    const payload = JSON.stringify({ userId: b.id, user: b.id })
    const req = httpRequest(base + 'login-activity', { method: 'GET', headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }))
    })
    req.on('error', reject)
    req.end(payload)
  })
  assert.equal(bodyResult.status, 200)
  assert.ok(bodyResult.body.activities.every(item => item.userAgent !== 'Private B Agent'))
})
test('empty history and unexpected query failures have safe responses', async t => {
  assert.deepEqual(await (await history()).json(), { activities: [] })
  t.mock.method(LoginActivity, 'find', () => { throw new Error('private database diagnostic') })
  const response = await history()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
})
test('account deletion removes only A history with A applications, preserving B data', async () => {
  await login()
  await login()
  await seed(b.id, new Date(), 'B Agent')
  const beforeB = await LoginActivity.collection.find({ user: b._id }).toArray()
  await Application.create([{ owner: a.id, company: 'A1', position: 'Intern' }, { owner: b.id, company: 'B1', position: 'Intern' }])
  assert.equal((await remove()).status, 200)
  assert.equal(await User.findById(a.id), null)
  assert.equal(await LoginActivity.countDocuments({ user: a.id }), 0)
  assert.equal(await Application.countDocuments({ owner: a.id }), 0)
  assert.ok(await User.findById(b.id))
  assert.deepEqual(await LoginActivity.collection.find({ user: b._id }).toArray(), beforeB)
  assert.equal(await Application.countDocuments({ owner: b.id }), 1)
  assert.equal((await history(tokenA)).status, 401)
  assert.equal((await history(tokenB)).status, 200)
})
test('activity cleanup failure retains account, reports safe error and supports retry', async t => {
  await seed(a.id, new Date())
  const mock = t.mock.method(LoginActivity, 'deleteMany', async () => { throw new Error('private activity cleanup diagnostic') })
  const response = await remove()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
  assert.ok(await User.findById(a.id))
  assert.equal(await LoginActivity.countDocuments({ user: a.id }), 1)
  mock.mock.restore()
  assert.equal((await remove()).status, 200)
  assert.equal(await LoginActivity.countDocuments({ user: a.id }), 0)
})
test('activity recording already in flight finishes before deletion cleanup', async t => {
  let release, started
  const entered = new Promise(resolve => { started = resolve })
  const proceed = new Promise(resolve => { release = resolve })
  const create = LoginActivity.create.bind(LoginActivity)
  t.mock.method(LoginActivity, 'create', async (...args) => { started(); await proceed; return create(...args) })
  const loggingIn = login()
  await entered
  const deleting = remove()
  release()
  assert.equal((await loggingIn).status, 200)
  assert.equal((await deleting).status, 200)
  assert.equal(await LoginActivity.countDocuments({ user: a.id }), 0)
})
test('recording waiting behind deletion cannot recreate activity for a missing user', async t => {
  let release, started
  const entered = new Promise(resolve => { started = resolve })
  const proceed = new Promise(resolve => { release = resolve })
  const cleanup = LoginActivity.deleteMany.bind(LoginActivity)
  t.mock.method(LoginActivity, 'deleteMany', async (...args) => { started(); await proceed; return cleanup(...args) })
  const deleting = remove()
  await entered
  const recording = recordSuccessfulLogin(a.id, { ip: '127.0.0.1', get: () => agent })
  release()
  assert.equal((await deleting).status, 200)
  await recording
  assert.equal(await LoginActivity.countDocuments({ user: a.id }), 0)
})
