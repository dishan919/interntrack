import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatUserAgent, formatLoginTime } from '../src/utils/loginActivity.js'
import { getLoginActivity } from '../src/services/authService.js'
import { setAccessToken, getAccessToken } from '../src/services/authSession.js'

test('user-agent labels use common browser/platform hints with conservative fallback', () => {
  for (const [agent, label] of [
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36', 'Chrome on Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/131.0', 'Firefox on Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 'Safari on macOS'],
    ['Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15 Safari/604.1', 'Safari on iOS'],
    ['Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 OPR/115.0', 'Opera on Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0', 'Firefox on Linux'],
  ]) assert.equal(formatUserAgent(agent), label)
  for (const value of ['', null, {}, 'custom-client', '<script>alert(1)</script>', 'Chrome/130.0', 'Windows NT 10.0']) assert.equal(formatUserAgent(value), 'Unknown browser/device')
})
test('login time formatter uses valid date/time and handles unknown data safely', () => {
  assert.equal(formatLoginTime('2026-10-20T12:34:00.000Z'), new Date('2026-10-20T12:34:00.000Z').toLocaleString())
  for (const value of ['', 'invalid', null, undefined, {}]) assert.equal(formatLoginTime(value), 'Unknown date/time')
})
test('history service authenticates, keeps API order, and allowlists only activity display fields', async t => {
  const activities = [
    { id: 'newest', loggedInAt: '2026-10-20T12:00:00.000Z', ipAddress: '192.0.2.1', userAgent: 'Chrome/130.0' },
    { id: 'older', loggedInAt: '2026-10-19T12:00:00.000Z', ipAddress: '', userAgent: '' },
  ]
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/auth/login-activity')
    assert.deepEqual(options, { headers: { Authorization: 'Bearer history-session' } })
    return new Response(JSON.stringify({ activities: activities.map(item => ({ ...item, user: 'private-id', password: 'private', accessToken: 'private', emailVerificationTokenHash: 'private' })), token: 'private' }))
  })
  assert.deepEqual(await getLoginActivity('history-session'), { activities })
})
test('history service sanitizes server/network/malformed data and allows empty history', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('private diagnostics', { status: 500 }))
  await assert.rejects(getLoginActivity('session'), { message: 'Unable to load login activity. Please try again.' })
  mock.mock.mockImplementation(async () => { throw new Error('private network diagnostics') })
  await assert.rejects(getLoginActivity('session'), /Check your connection/)
  for (const body of ['invalid JSON', '{}', '{"activities":{}}', '{"activities":[null]}', '{"activities":[{"id":"id","loggedInAt":"bad","ipAddress":"","userAgent":""}]}', '{"activities":[{"id":"id","loggedInAt":"2026-10-20T00:00:00Z","ipAddress":{},"userAgent":""}]}']) {
    mock.mock.mockImplementation(async () => new Response(body))
    await assert.rejects(getLoginActivity('session'), { message: 'Unable to load login activity. Please try again.' })
  }
  mock.mock.mockImplementation(async () => new Response('{"activities":[]}'))
  assert.deepEqual(await getLoginActivity('session'), { activities: [] })
})
test('history 401 invalidates only matching session; temporary failures retain authentication', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('private', { status: 500 }))
  setAccessToken('current')
  try {
    await assert.rejects(getLoginActivity('current'), /Unable to load/)
    assert.equal(getAccessToken(), 'current')
    mock.mock.mockImplementation(async () => new Response('private', { status: 401 }))
    await assert.rejects(getLoginActivity('old'), /session has expired/)
    assert.equal(getAccessToken(), 'current')
    await assert.rejects(getLoginActivity('current'), /session has expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(null) }
})
