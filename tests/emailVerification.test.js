import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyEmail, resendEmailVerification, register, login, getCurrentUser, updateProfile, VERIFIED_MESSAGE, RESENT_MESSAGE, ALREADY_VERIFIED_MESSAGE, INVALID_VERIFICATION_MESSAGE } from '../src/services/authService.js'
import { setAccessToken, getAccessToken } from '../src/services/authSession.js'

test('verification service sends only token, no bearer, and sanitizes returned secrets', async t => {
  setAccessToken('existing-session')
  t.after(() => setAccessToken(null))
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/verify-email')
    assert.equal(options.method, 'POST')
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json' })
    assert.deepEqual(JSON.parse(options.body), { token: 'temporary-token' })
    return new Response(JSON.stringify({ message: VERIFIED_MESSAGE, token: 'private', user: { password: 'private' } }))
  })
  assert.deepEqual(await verifyEmail('temporary-token'), { message: VERIFIED_MESSAGE })
})
test('resend uses current JWT, empty body and allowlisted success responses', async t => {
  let message = RESENT_MESSAGE
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/resend-verification')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer session-token')
    assert.deepEqual(JSON.parse(options.body), {})
    return new Response(JSON.stringify({ message, token: 'private' }))
  })
  assert.deepEqual(await resendEmailVerification('session-token'), { message: RESENT_MESSAGE })
  message = ALREADY_VERIFIED_MESSAGE
  assert.deepEqual(await resendEmailVerification('session-token'), { message })
})
test('verification services sanitize errors and malformed responses', async t => {
  const mock = t.mock.method(globalThis, 'fetch')
  for (const status of [400, 500]) {
    mock.mock.mockImplementation(async () => new Response('private diagnostic', { status }))
    await assert.rejects(verifyEmail('token'), { message: status === 400 ? INVALID_VERIFICATION_MESSAGE : 'Unable to process verification. Please try again.' })
    await assert.rejects(resendEmailVerification('token'), /Unable to process verification/)
  }
  for (const body of ['invalid JSON', '{}', '{"message":"private diagnostic"}']) {
    mock.mock.mockImplementation(async () => new Response(body))
    await assert.rejects(verifyEmail('token'), /invalid response/)
    await assert.rejects(resendEmailVerification('token'), /invalid response/)
  }
  mock.mock.mockImplementation(async () => { throw new Error('private network diagnostic') })
  await assert.rejects(verifyEmail('token'), /Check your connection/)
  await assert.rejects(resendEmailVerification('token'), /Check your connection/)
})
test('resend 401 invalidates only matching session; public verification cannot log users out', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('private', { status: 401 }))
  setAccessToken('current')
  try {
    await assert.rejects(resendEmailVerification('old'), /session has expired/)
    assert.equal(getAccessToken(), 'current')
    await assert.rejects(verifyEmail('token'), /Unable to process verification/)
    assert.equal(getAccessToken(), 'current')
    await assert.rejects(resendEmailVerification('current'), /session has expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(null) }
})
test('register/login/me/profile retain only safe boolean verification state', async t => {
  const user = { id: 'user', name: 'Test', email: 'test@example.com', emailVerified: false }
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ user: { ...user, emailVerificationTokenHash: 'private', emailVerificationExpiresAt: 'private', token: 'private', password: 'private' }, accessToken: 'session' })))
  assert.deepEqual(await register({ name: user.name, email: user.email, password: 'Password123' }), { user })
  assert.deepEqual(await login({ email: user.email, password: 'Password123' }), { user, accessToken: 'session' })
  user.emailVerified = true
  assert.deepEqual(await getCurrentUser('session'), { user })
  assert.deepEqual(await updateProfile('session', { name: user.name, emailVerified: true }), { user })
})
