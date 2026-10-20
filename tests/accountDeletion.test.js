import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deleteAccount } from '../src/services/authService.js'
import { setAccessToken, getAccessToken } from '../src/services/authSession.js'

test('delete account uses exact DELETE contract, preserves password whitespace and returns minimal message', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/me')
    assert.equal(options.method, 'DELETE')
    assert.deepEqual(options.headers, { Authorization: 'Bearer current-session', 'Content-Type': 'application/json' })
    assert.deepEqual(JSON.parse(options.body), { currentPassword: ' CurrentPassword123 ' })
    return new Response(JSON.stringify({ message: 'Account deleted successfully.', user: { password: 'private' }, token: 'private' }))
  })
  assert.deepEqual(await deleteAccount('current-session', ' CurrentPassword123 '), { message: 'Account deleted successfully.' })
})
test('delete account sanitizes validation, server, network, conflict and malformed responses', async t => {
  const mock = t.mock.method(globalThis, 'fetch')
  for (const message of ['Current password is required', 'Current password is incorrect.']) {
    mock.mock.mockImplementation(async () => new Response(JSON.stringify({ message }), { status: 400 }))
    await assert.rejects(deleteAccount('session', ''), { message })
  }
  for (const status of [400, 409, 500]) {
    mock.mock.mockImplementation(async () => new Response('{"message":"private database diagnostic"}', { status }))
    await assert.rejects(deleteAccount('session', 'password'), { message: status === 409 ? 'Account changed. Please sign in again and retry.' : 'Unable to delete your account right now. Please try again.' })
  }
  mock.mock.mockImplementation(async () => { throw new Error('private network diagnostic') })
  await assert.rejects(deleteAccount('session', 'password'), /Check your connection/)
  for (const body of ['invalid JSON', '{}', '{"message":"private diagnostic"}']) {
    mock.mock.mockImplementation(async () => new Response(body))
    await assert.rejects(deleteAccount('session', 'password'), /invalid response/)
  }
})
test('failed deletion keeps session except matching 401; stale 401 cannot log out newer user', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('private', { status: 500 }))
  setAccessToken('current-session')
  try {
    await assert.rejects(deleteAccount('current-session', 'password'), /Unable to delete/)
    assert.equal(getAccessToken(), 'current-session')
    mock.mock.mockImplementation(async () => new Response('private', { status: 401 }))
    await assert.rejects(deleteAccount('old-session', 'password'), /session has expired/)
    assert.equal(getAccessToken(), 'current-session')
    await assert.rejects(deleteAccount('current-session', 'password'), /session has expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(null) }
})
