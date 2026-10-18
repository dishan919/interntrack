import test from 'node:test'
import assert from 'node:assert/strict'
import { login } from '../src/services/authService.js'
import { validateLogin } from '../src/utils/login.js'

const credentials = { email: ' user@example.com ', password: ' Password123 ' }
test('login validates required email/password, email format and short passwords', () => {
  assert.deepEqual(validateLogin({ email: '', password: ' ' }), { email: 'Email is required.', password: 'Password is required.' })
  assert.ok(validateLogin({ ...credentials, email: 'invalid' }).email)
  assert.ok(validateLogin({ ...credentials, password: 'short' }).password)
  assert.deepEqual(validateLogin(credentials), {})
})
test('login posts only email/password, preserves password whitespace and returns safe user/token in memory', async t => {
  const user = { id: 'test-id', name: 'Example User', email: 'user@example.com' }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/login')
    assert.equal(options.method, 'POST')
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json' })
    assert.deepEqual(JSON.parse(options.body), { email: 'user@example.com', password: credentials.password })
    return new Response(JSON.stringify({ user: { ...user, password: 'private' }, accessToken: 'test-only-token' }))
  })
  assert.deepEqual(await login({ ...credentials, confirmPassword: 'ignored' }), { user, accessToken: 'test-only-token' })
})
test('login safely handles invalid credentials, validation, configuration, server, network and malformed responses', async t => {
  const fetch = t.mock.method(globalThis, 'fetch')
  for (const [status, expected] of [[401, 'Invalid email or password'], [400, 'Please check your email and password and try again.'], [503, 'Unable to sign in right now. Please try again.'], [500, 'Unable to sign in right now. Please try again.']]) {
    fetch.mock.mockImplementation(async () => new Response('private stack trace', { status }))
    await assert.rejects(login(credentials), { message: expected })
  }
  fetch.mock.mockImplementation(async () => { throw new Error('private connection diagnostic') })
  await assert.rejects(login(credentials), /Unable to reach the server/)
  for (const body of ['invalid JSON', '{}', JSON.stringify({ user: { id: 'id', name: 'Name', email: 'email' } }), JSON.stringify({ user: { id: 'id', name: 'Name', email: 'email' }, accessToken: '' })]) {
    fetch.mock.mockImplementation(async () => new Response(body))
    await assert.rejects(login(credentials), /invalid response/)
  }
})
