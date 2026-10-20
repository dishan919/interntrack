import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateResetEmail, validateResetPassword } from '../src/utils/passwordReset.js'
import { requestPasswordReset, resetPassword, RESET_REQUEST_MESSAGE } from '../src/services/authService.js'
test('reset email and shared password policy validation', () => {
  assert.ok(validateResetEmail(''))
  assert.ok(validateResetEmail('invalid'))
  assert.equal(validateResetEmail(' USER@example.com '), undefined)
  for (const newPassword of ['', 'short', ' '.repeat(8), 'x'.repeat(73)]) assert.ok(validateResetPassword({ newPassword, confirmNewPassword: newPassword }).newPassword)
  assert.ok(validateResetPassword({ newPassword: 'Password123', confirmNewPassword: 'different' }).confirmNewPassword)
  assert.deepEqual(validateResetPassword({ newPassword: ' Password123 ', confirmNewPassword: ' Password123 ' }), {})
})
test('public services use exact payload and discard unexpected response secrets', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) })
    return new Response(JSON.stringify({ message: 'private', token: 'secret' }))
  })
  assert.deepEqual(await requestPasswordReset(' user@example.com '), { message: RESET_REQUEST_MESSAGE })
  await resetPassword('test-token', 'Password123')
  assert.deepEqual(requests.map(item => item.body), [{ email: 'user@example.com' }, { token: 'test-token', newPassword: 'Password123' }])
})
