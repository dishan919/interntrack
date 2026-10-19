import test from 'node:test'
import assert from 'node:assert/strict'
import { validateProfile } from '../src/utils/profile.js'
import { updateProfile } from '../src/services/authService.js'
import { getAccessToken, setAccessToken } from '../src/services/authSession.js'

test('profile validation enforces required, trimmed name/email and schema lengths', () => {
  assert.deepEqual(validateProfile({ name: ' Example ', email: ' TEST@example.com ' }), {})
  for (const name of ['', '   ', 'x'.repeat(121)]) assert.ok(validateProfile({ name, email: 'test@example.com' }).name)
  for (const email of ['', ' ', 'invalid', `${'a'.repeat(250)}@example.com`]) assert.ok(validateProfile({ name: 'Example', email }).email)
})

test('profile service sends allowlisted PATCH and returns safe updated user', async t => {
  const user = { id: 'user', name: 'Updated', email: 'new@example.com' }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/me')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(options.headers, { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' })
    assert.deepEqual(JSON.parse(options.body), { name: 'Updated', email: 'new@example.com' })
    return new Response(JSON.stringify({ user: { ...user, password: 'secret' }, accessToken: 'secret' }))
  })
  assert.deepEqual(await updateProfile('test-token', { name: ' Updated ', email: ' new@example.com ', password: 'ignored', id: 'ignored' }), { user })
})

test('profile service safely handles errors and only invalidates matching 401 sessions', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('private diagnostics', { status: 400 }))
  for (const [status, message] of [[400, /check your name and email/], [409, /email already exists/], [500, /Unable to update your profile/]]) {
    mock.mock.mockImplementation(async () => new Response('private diagnostics', { status }))
    await assert.rejects(updateProfile('test-token', {}), message)
  }
  mock.mock.mockImplementation(async () => { throw new Error('private') })
  await assert.rejects(updateProfile('test-token', {}), /Check your connection/)
  for (const body of ['not JSON', '{}']) {
    mock.mock.mockImplementation(async () => new Response(body))
    await assert.rejects(updateProfile('test-token', {}), /invalid response/)
  }
  setAccessToken('new-token')
  try {
    mock.mock.mockImplementation(async () => new Response('private', { status: 401 }))
    await assert.rejects(updateProfile('old-token', {}), /session has expired/)
    assert.equal(getAccessToken(), 'new-token')
    await assert.rejects(updateProfile('new-token', {}), /session has expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(null) }
})
