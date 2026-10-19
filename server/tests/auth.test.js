import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import authenticate from '../src/middleware/authenticate.js'
import app from '../src/app.js'
import User from '../src/models/User.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'

let server
let baseUrl
let database
const valid = { name: 'Dishan', email: 'dishan@example.com', password: 'StrongPassword123' }
const testSecret = 'interntrack-disposable-tests-only-jwt-secret'
const originalSecret = process.env.JWT_SECRET

before(async () => {
  process.env.JWT_SECRET = testSecret
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}/api/auth/register`
})

beforeEach(async () => { await User.deleteMany({}) })

after(async () => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await disconnectDatabase()
  if (database) await database.stop()
})

function register(body = valid) {
  return fetch(baseUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function login(body = { email: valid.email, password: valid.password }) {
  return fetch(baseUrl.replace('/register', '/login'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function currentUser(authorization) {
  return fetch(baseUrl.replace('/register', '/me'), {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  })
}

function patchProfile(token, body) {
  return fetch(baseUrl.replace('/register', '/me'), { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
}

test('profile PATCH requires JWT, including rejection of expired tokens', async () => {
  for (const token of [null, 'invalid', jwt.sign({ sub: '0123456789abcdef01234567' }, testSecret, { expiresIn: -1 })]) {
    const response = await patchProfile(token, { name: 'Updated' })
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Unauthorized' })
  }
})

for (const updates of [{ name: '  New Name  ' }, { email: '  NEW@EXAMPLE.COM  ' }, { name: 'Both Updated', email: 'both@example.com' }, { email: valid.email.toUpperCase() }]) {
  test(`profile PATCH partial update ${JSON.stringify(updates)} preserves identity/password/JWT`, async () => {
    const user = await User.create(valid)
    const token = jwt.sign({ sub: user.id }, testSecret, { expiresIn: '1h' })
    const beforeUser = await User.collection.findOne({ _id: user._id })
    const response = await patchProfile(token, updates)
    assert.equal(response.status, 200)
    const expected = { user: { id: user.id, name: updates.name?.trim() || valid.name, email: updates.email?.trim().toLowerCase() || valid.email } }
    assert.deepEqual(await response.json(), expected)
    assert.deepEqual(await (await currentUser(`Bearer ${token}`)).json(), expected)
    const afterUser = await User.collection.findOne({ _id: user._id })
    assert.equal(afterUser.password, beforeUser.password)
  })
}

test('profile PATCH cannot target another user or change sensitive fields', async () => {
  const a = await User.create(valid)
  const b = await User.create({ ...valid, email: 'other@example.com' })
  const beforeA = await User.collection.findOne({ _id: a._id })
  const beforeB = await User.collection.findOne({ _id: b._id })
  const token = jwt.sign({ sub: a.id }, testSecret, { expiresIn: '1h' })
  const response = await patchProfile(token, { name: 'Only A', userId: b.id, id: b.id, _id: b.id, owner: b.id, role: 'admin', password: 'ChangedPassword123', passwordHash: 'forged', accessToken: 'forged', $set: { email: b.email } })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { user: { id: a.id, name: 'Only A', email: a.email } })
  const afterA = await User.collection.findOne({ _id: a._id })
  assert.equal(afterA.password, beforeA.password)
  for (const key of ['role', 'owner', 'passwordHash', 'accessToken', 'userId']) assert.equal(afterA[key], undefined)
  assert.deepEqual(await User.collection.findOne({ _id: b._id }), beforeB)
})

for (const [label, body] of [
  ['empty', {}], ['unsupported only', { password: 'ChangedPassword123', userId: 'other' }],
  ['blank name', { name: '   ' }], ['null name', { name: null }], ['long name', { name: 'x'.repeat(121) }],
  ['invalid email', { email: 'invalid' }], ['blank email', { email: ' ' }], ['null email', { email: null }],
  ['long email', { email: `${'a'.repeat(250)}@example.com` }], ['array', []], ['null', null],
  ['atomic validation', { name: 'Do not save', email: 'invalid' }],
]) {
  test(`profile PATCH rejects ${label} without changing the user`, async () => {
    const user = await User.create(valid)
    const token = jwt.sign({ sub: user.id }, testSecret, { expiresIn: '1h' })
    const beforeUser = await User.collection.findOne({ _id: user._id })
    assert.equal((await patchProfile(token, body)).status, 400)
    assert.deepEqual(await User.collection.findOne({ _id: user._id }), beforeUser)
  })
}

test('profile PATCH handles duplicate normalized email and database unique-index races safely', async () => {
  const a = await User.create(valid)
  const b = await User.create({ ...valid, email: 'other@example.com' })
  const tokenA = jwt.sign({ sub: a.id }, testSecret, { expiresIn: '1h' })
  const tokenB = jwt.sign({ sub: b.id }, testSecret, { expiresIn: '1h' })
  const duplicate = await patchProfile(tokenA, { name: 'Must not change', email: ' OTHER@EXAMPLE.COM ' })
  assert.equal(duplicate.status, 409)
  assert.deepEqual(await duplicate.json(), { message: 'An account with this email already exists' })
  assert.equal((await User.findById(a.id)).name, a.name)
  const results = await Promise.all([patchProfile(tokenA, { email: 'race@example.com' }), patchProfile(tokenB, { email: 'RACE@example.com' })])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
  assert.equal(await User.countDocuments({ email: 'race@example.com' }), 1)
})

test('profile PATCH deleted user returns 401 and database failures stay generic', async t => {
  const token = jwt.sign({ sub: '0123456789abcdef01234567' }, testSecret, { expiresIn: '1h' })
  assert.equal((await patchProfile(token, { name: 'Updated' })).status, 401)
  t.mock.method(User, 'findByIdAndUpdate', async () => { throw new Error('private database diagnostic') })
  const response = await patchProfile(token, { name: 'Updated' })
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
})

test('/me accepts a login token and returns only safe current user fields', async () => {
  const registered = await (await register()).json()
  const { accessToken } = await (await login()).json()
  const stored = await User.collection.findOne({ email: valid.email })
  const response = await currentUser(`Bearer ${accessToken}`)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, registered)
  assert.ok(!JSON.stringify(body).includes(valid.password))
  assert.ok(!JSON.stringify(body).includes(stored.password))
})

for (const [label, authorization] of [
  ['missing header', undefined], ['empty header', ''], ['wrong scheme', 'Basic abc'],
  ['missing token', 'Bearer'], ['extra credentials', 'Bearer abc def'], ['invalid token', 'Bearer invalid'],
]) {
  test(`/me rejects ${label} with safe 401`, async () => {
    const response = await currentUser(authorization)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Unauthorized' })
  })
}

test('/me rejects expired, forged, unsigned, wrong-algorithm, and invalid-claim tokens', async () => {
  const sub = '0123456789abcdef01234567'
  const tokens = [
    jwt.sign({ sub }, testSecret, { expiresIn: -1 }),
    jwt.sign({ sub }, 'different-test-secret', { expiresIn: '1h' }),
    jwt.sign({ sub }, null, { algorithm: 'none', expiresIn: '1h' }),
    jwt.sign({ sub }, testSecret, { algorithm: 'HS384', expiresIn: '1h' }),
    jwt.sign({}, testSecret, { expiresIn: '1h' }),
    jwt.sign({ sub: 'invalid-id' }, testSecret, { expiresIn: '1h' }),
    jwt.sign({ sub }, testSecret),
  ]
  for (const token of tokens) {
    const response = await currentUser(`Bearer ${token}`)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Unauthorized' })
  }
})

test('/me rejects a deleted token user', async () => {
  await register()
  const { accessToken } = await (await login()).json()
  await User.deleteMany({})
  const response = await currentUser(`Bearer ${accessToken}`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { message: 'Unauthorized' })
})

test('middleware exposes req.auth.userId without querying MongoDB', t => {
  t.mock.method(User, 'findById', () => { throw new Error('Unexpected database query') })
  const userId = '0123456789abcdef01234567'
  const token = jwt.sign({}, testSecret, { subject: userId, expiresIn: '1h' })
  const req = { get: () => `Bearer ${token}` }
  let called = false
  authenticate(req, {}, () => { called = true })
  assert.equal(called, true)
  assert.deepEqual(req.auth, { userId })
})

test('missing or blank JWT configuration fails safely without leaking secrets', async () => {
  await register()
  try {
    for (const secret of [undefined, '   ']) {
      if (secret === undefined) delete process.env.JWT_SECRET
      else process.env.JWT_SECRET = secret
      for (const response of [await login(), await currentUser('Bearer invalid')]) {
        assert.equal(response.status, 503)
        assert.deepEqual(await response.json(), { message: 'Authentication is not configured' })
      }
      const invalidLogin = await login({ email: valid.email, password: 'wrong' })
      assert.equal(invalidLogin.status, 401)
    }
  } finally {
    process.env.JWT_SECRET = testSecret
  }
})

test('/me database errors return generic 500 responses', async t => {
  t.mock.method(User, 'findById', () => { throw new Error('Private database diagnostic') })
  const token = jwt.sign({}, testSecret, { subject: '0123456789abcdef01234567', expiresIn: '1h' })
  const response = await currentUser(`Bearer ${token}`)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
})

test('login verifies the registered bcrypt hash and returns only safe user fields', async t => {
  const registered = await (await register()).json()
  const stored = await User.collection.findOne({ email: valid.email })
  assert.notEqual(stored.password, valid.password)
  assert.equal((await User.findOne({ email: valid.email })).password, undefined)
  const compare = t.mock.method(bcrypt, 'compare')
  const response = await login({ email: '  DISHAN@Example.COM  ', password: valid.password })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.user, registered.user)
  assert.deepEqual(Object.keys(body).sort(), ['accessToken', 'user'])
  const claims = jwt.verify(body.accessToken, testSecret, { algorithms: ['HS256'] })
  assert.deepEqual(Object.keys(claims).sort(), ['exp', 'iat', 'sub'])
  assert.equal(claims.sub, registered.user.id)
  assert.equal(claims.exp - claims.iat, 3600)
  assert.ok(claims.exp > Math.floor(Date.now() / 1000))
  assert.ok(!JSON.stringify(claims).includes(valid.password))
  assert.ok(!JSON.stringify(claims).includes(stored.password))
  assert.equal(compare.mock.callCount(), 1)
  assert.deepEqual(compare.mock.calls[0].arguments, [valid.password, stored.password])
  assert.ok(!JSON.stringify(body).includes(valid.password))
  assert.ok(!JSON.stringify(body).includes(stored.password))
})

test('wrong password and unknown email return identical safe 401 responses', async () => {
  await register()
  for (const credentials of [
    { email: valid.email, password: 'WrongPassword123' },
    { email: 'unknown@example.com', password: valid.password },
  ]) {
    const response = await login(credentials)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Invalid email or password' })
  }
})

for (const [label, body, message] of [
  ['missing email', { password: valid.password }, 'A valid email address is required'],
  ['blank email', { email: ' ', password: valid.password }, 'A valid email address is required'],
  ['invalid email', { email: 'not-an-email', password: valid.password }, 'A valid email address is required'],
  ['email object', { email: { $ne: null }, password: valid.password }, 'A valid email address is required'],
  ['long email', { email: `${'a'.repeat(250)}@example.com`, password: valid.password }, 'A valid email address is required'],
  ['missing password', { email: valid.email }, 'Password is required'],
  ['blank password', { email: valid.email, password: ' ' }, 'Password is required'],
  ['password object', { email: valid.email, password: { $ne: null } }, 'Password is required'],
  ['array body', [], 'Invalid login data'],
]) {
  test(`login rejects ${label} with safe 400`, async () => {
    const response = await login(body)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { message })
  })
}

test('login preserves password whitespace and rejects bcrypt truncation matches', async () => {
  const password = '  StrongPassword123  '
  await register({ ...valid, password })
  assert.equal((await login({ email: valid.email, password })).status, 200)
  assert.equal((await login({ email: valid.email, password: password.trim() })).status, 401)
  await register({ ...valid, email: 'boundary@example.com', password: 'p'.repeat(72) })
  for (const password of ['p'.repeat(73), `${'p'.repeat(72)}é`]) {
    const response = await login({ email: 'boundary@example.com', password })
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Invalid email or password' })
  }
})

test('login database failures return a generic 500 without diagnostics', async t => {
  t.mock.method(User, 'findOne', () => { throw new Error('Private database diagnostic') })
  const response = await login()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
})

test('registration returns 201 with only safe user fields and normalizes name/email', async () => {
  const response = await register({ ...valid, name: ' Dishan ', email: ' Dishan@Example.COM ', role: 'admin', userId: 'client-id' })
  assert.equal(response.status, 201)
  const body = await response.json()
  assert.deepEqual(Object.keys(body), ['user'])
  assert.match(body.user.id, /^[a-f0-9]{24}$/)
  assert.deepEqual(body, { user: { id: body.user.id, name: 'Dishan', email: valid.email } })
  const stored = await User.collection.findOne({ email: valid.email })
  assert.equal(stored.role, undefined)
  assert.equal(stored.userId, undefined)
  assert.ok(stored.createdAt instanceof Date)
  assert.ok(stored.updatedAt instanceof Date)
  assert.equal(await User.countDocuments(), 1)
})

test('MongoDB stores a salted bcrypt hash; queries and JSON omit the password/hash', async () => {
  const response = await register()
  const body = await response.json()
  const stored = await User.collection.findOne({ email: valid.email })
  assert.notEqual(stored.password, valid.password)
  assert.match(stored.password, /^\$2[aby]\$12\$/)
  assert.equal(bcrypt.getRounds(stored.password), 12)
  assert.equal(await bcrypt.compare(valid.password, stored.password), true)
  assert.equal(await bcrypt.compare('IncorrectPassword', stored.password), false)
  assert.equal((await User.findOne({ email: valid.email })).password, undefined)
  const selected = await User.findOne({ email: valid.email }).select('+password')
  assert.equal(selected.toJSON().password, undefined)
  assert.ok(!JSON.stringify(body).includes(valid.password))
  assert.ok(!JSON.stringify(body).includes(stored.password))
})

for (const email of [valid.email, 'DISHAN@EXAMPLE.COM', '  Dishan@Example.com  ']) {
  test(`duplicate registration rejects normalized email ${JSON.stringify(email)}`, async () => {
    await register()
    const response = await register({ ...valid, email, name: 'Another name' })
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { message: 'An account with this email already exists' })
    assert.equal(await User.countDocuments(), 1)
    assert.equal((await User.findOne()).name, valid.name)
  })
}

test('concurrent registrations cannot bypass email uniqueness', async () => {
  const responses = await Promise.all([register(), register({ ...valid, email: 'DISHAN@EXAMPLE.COM' })])
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409])
  const conflict = responses.find(response => response.status === 409)
  assert.deepEqual(await conflict.json(), { message: 'An account with this email already exists' })
  assert.equal(await User.countDocuments(), 1)
})

for (const [label, body, message] of [
  ['missing name', { ...valid, name: undefined }, 'Name is required'],
  ['blank name', { ...valid, name: '   ' }, 'Name is required'],
  ['non-string name', { ...valid, name: 123 }, 'Name is required'],
  ['long name', { ...valid, name: 'n'.repeat(121) }, 'Name must be at most 120 characters'],
  ['missing email', { ...valid, email: undefined }, 'A valid email address is required'],
  ['invalid email', { ...valid, email: 'not-an-email' }, 'A valid email address is required'],
  ['email without domain suffix', { ...valid, email: 'name@example' }, 'A valid email address is required'],
  ['email containing spaces', { ...valid, email: 'name @example.com' }, 'A valid email address is required'],
  ['email object', { ...valid, email: { $ne: null } }, 'A valid email address is required'],
  ['short password', { ...valid, password: 'short' }, 'Password must be at least 8 characters'],
  ['missing password', { ...valid, password: undefined }, 'Password must be at least 8 characters'],
  ['non-string password', { ...valid, password: 12345678 }, 'Password must be at least 8 characters'],
  ['blank password', { ...valid, password: '        ' }, 'Password must be at least 8 characters'],
  ['oversized password', { ...valid, password: 'p'.repeat(73) }, 'Password must be at most 72 UTF-8 bytes'],
  ['multibyte oversized password', { ...valid, password: '\u00e9'.repeat(37) }, 'Password must be at most 72 UTF-8 bytes'],
  ['null body', null, 'Invalid request'],
  ['array body', [], 'Invalid registration data'],
]) {
  test(`rejects ${label} with a safe 400 and creates no user`, async () => {
    const response = await register(body)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { message })
    assert.equal(await User.countDocuments(), 0)
  })
}

test('malformed JSON and an absent body return safe 400 responses', async () => {
  for (const body of ['{', undefined]) {
    const response = await fetch(baseUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { message: body ? 'Invalid request' : 'Name is required' })
    assert.equal(await User.countDocuments(), 0)
  }
})

test('model saves hash only modified passwords and preserve password whitespace', async () => {
  const password = '  StrongPassword123  '
  const user = await User.create({ ...valid, password })
  const firstHash = user.password
  assert.equal(await bcrypt.compare(password, firstHash), true)
  assert.equal(await bcrypt.compare(password.trim(), firstHash), false)
  user.name = 'Updated name'
  await user.save()
  assert.equal(user.password, firstHash)
  user.password = 'ChangedPassword456'
  await user.save()
  assert.notEqual(user.password, firstHash)
  assert.equal(await bcrypt.compare('ChangedPassword456', user.password), true)
})

test('password length boundaries are accepted without truncation', async () => {
  for (const password of ['Eight123', 'p'.repeat(72)]) {
    const email = `boundary${password.length}@example.com`
    const response = await register({ ...valid, email, password })
    assert.equal(response.status, 201)
    const stored = await User.collection.findOne({ email })
    assert.equal(await bcrypt.compare(password, stored.password), true)
  }
})

test('unexpected database errors return generic 500 responses without diagnostics', async t => {
  t.mock.method(User, 'create', async () => { throw new Error('Private database diagnostic') })
  const response = await register()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
  assert.equal(await User.countDocuments(), 0)
})

// Exercise the actual frontend login service against Express and disposable MongoDB.
test('frontend login service verifies real registered credentials through the existing API', async t => {
  await register()
  const { login: frontendLogin } = await import('../../src/services/authService.js')
  const originalFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', (url, options) => originalFetch(
    url.replace('http://localhost:5000/api/auth/login', baseUrl.replace('/register', '/login')), options,
  ))
  const result = await frontendLogin({ email: valid.email, password: valid.password })
  assert.equal(result.user.email, valid.email)
  assert.equal(jwt.verify(result.accessToken, testSecret, { algorithms: ['HS256'] }).sub, result.user.id)
  await assert.rejects(frontendLogin({ email: valid.email, password: 'WrongPassword123' }), { message: 'Invalid email or password' })
})
