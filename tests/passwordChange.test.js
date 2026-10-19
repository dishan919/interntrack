import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePasswordChange } from '../src/utils/passwordChange.js'
import { changePassword } from '../src/services/authService.js'
import { getAccessToken, setAccessToken } from '../src/services/authSession.js'

test('password-change validation enforces required fields, policy, confirmation and different passwords', () => {
  const valid = { currentPassword: 'OriginalPassword123', newPassword: ' NewPassword123 ', confirmNewPassword: ' NewPassword123 ' }
  assert.deepEqual(validatePasswordChange(valid), {})
  assert.equal(Object.keys(validatePasswordChange({ currentPassword: '', newPassword: '', confirmNewPassword: '' })).length, 3)
  for (const value of ['short', ' '.repeat(8), 'x'.repeat(73), '😀'.repeat(19), valid.currentPassword]) {
    assert.ok(validatePasswordChange({ ...valid, newPassword: value }).newPassword)
  }
  assert.ok(validatePasswordChange({ ...valid, confirmNewPassword: 'different' }).confirmNewPassword)
})

test('password service sends only exact password values and returns minimal safe success', async t => {
  const values = { currentPassword: ' CurrentPassword123 ', newPassword: ' NewPassword123 ' }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/password')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(options.headers, { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' })
    assert.deepEqual(JSON.parse(options.body), values)
    return new Response(JSON.stringify({ message: 'Password changed successfully.', password: 'private', accessToken: 'private' }))
  })
  assert.deepEqual(await changePassword('test-token', { ...values, confirmNewPassword: values.newPassword, userId: 'ignored' }), { message: 'Password changed successfully.' })
})

test('password service sanitizes errors, handles bad responses and preserves stale-token isolation', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('{}'))
  for (const message of ['Current password is incorrect.', 'New password must be at least 8 characters', 'New password must be different from the current password.']) {
    mock.mock.mockImplementation(async () => new Response(JSON.stringify({ message }), { status: 400 }))
    await assert.rejects(changePassword('token', {}), error => error.message === message)
  }
  mock.mock.mockImplementation(async () => new Response('{"message":"private database details"}', { status: 400 }))
  await assert.rejects(changePassword('token', {}), /check your password details/)
  mock.mock.mockImplementation(async () => new Response('private database details', { status: 500 }))
  await assert.rejects(changePassword('token', {}), /Unable to change your password/)
  mock.mock.mockImplementation(async () => { throw new Error('private') })
  await assert.rejects(changePassword('token', {}), /Check your connection/)
  for (const body of ['not JSON', '{}']) {
    mock.mock.mockImplementation(async () => new Response(body))
    await assert.rejects(changePassword('token', {}), /invalid response/)
  }
  setAccessToken('current-token')
  try {
    mock.mock.mockImplementation(async () => new Response('private', { status: 401 }))
    await assert.rejects(changePassword('old-token', {}), /session has expired/)
    assert.equal(getAccessToken(), 'current-token')
    await assert.rejects(changePassword('current-token', {}), /session has expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(null) }
})
