import test from 'node:test'
import assert from 'node:assert/strict'
import { TOKEN_KEY, readStoredToken, storeToken, removeStoredToken, getAccessToken, setAccessToken, bearerHeaders, invalidateSession, onUnauthorized } from '../src/services/authSession.js'
import { getCurrentUser } from '../src/services/authService.js'
import * as applications from '../src/services/applicationService.js'

test('session helpers store only the token and handle unavailable storage safely', t => {
  const data = new Map()
  const oldWindow = globalThis.window
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow })
  globalThis.window = { sessionStorage: { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } }
  assert.equal(readStoredToken(), null)
  storeToken('test-token')
  assert.equal(readStoredToken(), 'test-token')
  assert.deepEqual([...data], [[TOKEN_KEY, 'test-token']])
  removeStoredToken()
  assert.equal(readStoredToken(), null)
  globalThis.window.sessionStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  assert.equal(readStoredToken(), null)
  assert.throws(() => storeToken('test-token'), /Session storage is unavailable/)
  assert.doesNotThrow(removeStoredToken)
})

test('/auth/me sends Bearer token, returns only safe user, and rejects invalid/error responses', async t => {
  const user = { id: 'test-user', name: 'Test User', email: 'test@example.com' }
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/me')
    assert.deepEqual(options.headers, { Authorization: 'Bearer test-token' })
    return new Response(JSON.stringify({ user: { ...user, password: 'private' } }))
  })
  assert.deepEqual(await getCurrentUser('test-token'), { user })
  for (const status of [401, 500]) {
    fetch.mock.mockImplementation(async () => new Response('private diagnostic', { status }))
    await assert.rejects(getCurrentUser('test-token'), /Unable to verify your session/)
  }
  for (const body of ['invalid JSON', '{}']) {
    fetch.mock.mockImplementation(async () => new Response(body))
    await assert.rejects(getCurrentUser('test-token'), /invalid response/)
  }
})

test('all application CRUD requests attach Bearer headers; stale 401 cannot invalidate a new session', async t => {
  const calls = []
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    const body = options.method === 'DELETE' ? null : options.method === 'GET' && url.endsWith('/applications') ? '[]' : '{"id":"record"}'
    return new Response(body, { status: options.method === 'DELETE' ? 204 : 200 })
  })
  setAccessToken('current-token')
  try {
    await applications.getApplications()
    await applications.getApplication('record')
    await applications.createApplication({ company: 'Example', position: 'Intern' })
    await applications.updateApplication('record', { company: 'Example', position: 'Intern' })
    await applications.deleteApplication('record')
    assert.equal(calls.length, 5)
    for (const { options } of calls) assert.equal(options.headers.Authorization, 'Bearer current-token')
    assert.equal(calls[2].options.headers['Content-Type'], 'application/json')
    let invalidations = 0
    const unsubscribe = onUnauthorized(() => { invalidations++ })
    try {
      invalidateSession('old-token')
      assert.equal(getAccessToken(), 'current-token')
      fetch.mock.mockImplementation(async () => new Response('private', { status: 401 }))
      await assert.rejects(applications.getApplications(), /session has expired/)
      assert.equal(getAccessToken(), null)
      assert.equal(invalidations, 1)
      assert.deepEqual(bearerHeaders(), {})
    } finally { unsubscribe() }
  } finally { setAccessToken(null) }
})
