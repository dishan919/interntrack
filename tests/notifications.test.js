import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../src/services/notificationService.js'
import { getAccessToken, setAccessToken } from '../src/services/authSession.js'
const item = { id: '0123456789abcdef01234567', type: 'status', title: 'Interview', message: 'Company status changed', read: false, createdAt: '2026-10-22T00:00:00Z', applicationId: 'abcdef0123456789abcdef01' }

test('notification service uses Bearer auth, safe API paths, and allowlisted responses', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(options.method === 'GET' ? { notifications: [{ ...item, user: 'private', eventKey: 'private' }], unreadCount: 1 } : { message: 'ok' }))
  })
  assert.deepEqual(await getNotifications('token'), { notifications: [item], unreadCount: 1 })
  await markNotificationRead('token', item.id)
  await markAllNotificationsRead('token')
  assert.deepEqual(calls.map(call => [call.url, call.options.method]), [
    ['http://localhost:5000/api/notifications', 'GET'],
    [`http://localhost:5000/api/notifications/${item.id}/read`, 'PATCH'],
    ['http://localhost:5000/api/notifications/read-all', 'PATCH'],
  ])
  assert.ok(calls.every(call => JSON.stringify(call.options.headers) === JSON.stringify({ Authorization: 'Bearer token' }) && call.options.body === undefined))
  await assert.rejects(markNotificationRead('token', '../foreign'), /Unable to load or update/)
  assert.equal(calls.length, 3)
})

test('malformed notification responses are rejected and unsafe application links discarded', async t => {
  for (const data of [null, {}, { notifications: [], unreadCount: -1 }, { notifications: Array(51).fill(item), unreadCount: 51 }, { notifications: [{ ...item, id: 'bad' }], unreadCount: 1 }, { notifications: [{ ...item, createdAt: 'invalid' }], unreadCount: 1 }, { notifications: [{ ...item, read: 'false' }], unreadCount: 1 }]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(data)))
    await assert.rejects(getNotifications('token'), /Unable to load or update/)
  }
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ notifications: [{ ...item, applicationId: 'javascript:alert(1)' }], unreadCount: 1 })))
  assert.equal((await getNotifications('token')).notifications[0].applicationId, undefined)
})

test('notification errors are sanitized and stale 401 cannot invalidate a newer session', async t => {
  const previous = getAccessToken()
  try {
    for (const status of [400, 404, 500]) {
      t.mock.method(globalThis, 'fetch', async () => new Response('private diagnostic', { status }))
      await assert.rejects(getNotifications('token'), error => !error.message.includes('private'))
    }
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('private network details') })
    await assert.rejects(getNotifications('token'), /Unable to load or update/)
    t.mock.method(globalThis, 'fetch', async () => new Response('invalid json'))
    await assert.rejects(getNotifications('token'), /Unable to load or update/)
    setAccessToken('new-session')
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }))
    await assert.rejects(getNotifications('old-session'), /session has expired/)
    assert.equal(getAccessToken(), 'new-session')
    await assert.rejects(getNotifications('new-session'), /session has expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(previous) }
})
