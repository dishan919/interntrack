import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRegistration } from '../src/utils/registration.js'
import { register } from '../src/services/authService.js'

const valid = { name: ' Test User ', email: ' test@example.com ', password: 'Password123', confirmPassword: 'Password123' }
test('registration validates required fields, email, password length and confirmation', () => {
  assert.equal(Object.keys(validateRegistration({ name: ' ', email: '', password: '', confirmPassword: '' })).length, 4)
  for (const [field, value] of [['email', 'invalid'], ['password', 'short'], ['confirmPassword', 'different']]) {
    assert.ok(validateRegistration({ ...valid, [field]: value })[field])
  }
  assert.deepEqual(validateRegistration(valid), {})
})
test('registration service sends only trimmed name/email and exact password and preserves safe user', async t => {
  const user = { id: 'test-id', name: 'Test User', email: 'test@example.com' }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/register')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { name: 'Test User', email: 'test@example.com', password: ' Password123 ' })
    return new Response(JSON.stringify({ user: { ...user, password: 'private' }, accessToken: 'unused' }), { status: 201 })
  })
  assert.deepEqual(await register({ ...valid, password: ' Password123 ' }), { user })
})
test('registration service handles duplicate, validation, network, server and malformed responses safely', async t => {
  const fetch = t.mock.method(globalThis, 'fetch')
  for (const [status, message, expected] of [
    [409, 'private', 'An account with this email already exists'],
    [400, 'Name is required', 'Name is required'],
    [400, 'private stack trace', 'Please check your details and try again.'],
    [500, 'private stack trace', 'Unable to create your account right now. Please try again.'],
  ]) {
    fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ message }), { status }))
    await assert.rejects(register(valid), { message: expected })
  }
  fetch.mock.mockImplementation(async () => { throw new Error('private database URI') })
  await assert.rejects(register(valid), /Unable to reach the server/)
  for (const body of ['invalid JSON', '{}']) {
    fetch.mock.mockImplementation(async () => new Response(body, { status: 201 }))
    await assert.rejects(register(valid), /invalid response/)
  }
})
