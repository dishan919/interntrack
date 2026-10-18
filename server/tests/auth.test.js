import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import bcrypt from 'bcryptjs'
import app from '../src/app.js'
import User from '../src/models/User.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'

let server
let baseUrl
let database
const valid = { name: 'Dishan', email: 'dishan@example.com', password: 'StrongPassword123' }

before(async () => {
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}/api/auth/register`
})

beforeEach(async () => { await User.deleteMany({}) })

after(async () => {
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

test('login verifies the registered bcrypt hash and returns only safe user fields', async t => {
  const registered = await (await register()).json()
  const stored = await User.collection.findOne({ email: valid.email })
  assert.notEqual(stored.password, valid.password)
  assert.equal((await User.findOne({ email: valid.email })).password, undefined)
  const compare = t.mock.method(bcrypt, 'compare')
  const response = await login({ email: '  DISHAN@Example.COM  ', password: valid.password })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, registered)
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
