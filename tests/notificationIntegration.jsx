import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { TOKEN_KEY } from '../src/services/authSession'

export default async function verify() {
  const originalFetch = globalThis.fetch, originalUrl = window.location.href
  const originalToken = window.sessionStorage.getItem(TOKEN_KEY)
  const container = document.createElement('div'); document.body.append(container)
  const base = import.meta.env.BASE_URL
  const applicationId = 'abcdef0123456789abcdef01'
  let items = [
    { id: '0123456789abcdef01234567', type: 'status', title: 'Application: Interview', message: '<script>Private Company A</script>', read: false, createdAt: '2026-10-22T01:00:00Z', applicationId },
    { id: '0123456789abcdef01234568', type: 'interview', title: 'Interview scheduled', message: 'Interview date confirmed', read: false, createdAt: '2026-10-21T01:00:00Z' },
    { id: '0123456789abcdef01234569', type: 'status', title: 'Application: Offer', message: 'Already read', read: true, createdAt: '2026-10-20T01:00:00Z' },
  ]
  const application = { id: applicationId, company: 'Private Company A', position: 'Intern', status: 'Interview' }
  let root, defer = true, status = 200, writes = 0, notificationReads = 0, completeWrite
  let pending = []
  const json = (data, code = 200) => new Response(JSON.stringify(data), { status: code })
  const panel = () => container.querySelector('.notification-panel')
  const bell = () => container.querySelector('.notification-bell')
  const button = text => [...panel().querySelectorAll('button')].find(node => node.textContent.startsWith(text))
  async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))) }
  async function mount(token) {
    if (root) await act(async () => root.unmount())
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token)
    else window.sessionStorage.removeItem(TOKEN_KEY)
    window.history.replaceState({}, '', `${base}applications`)
    root = createRoot(container); await act(async () => root.render(<App />))
  }
  function responseFor(token) {
    const notifications = token === 'Bearer notification-b' ? [] : items
    return json({ notifications, unreadCount: notifications.filter(item => !item.read).length })
  }
  try {
    globalThis.fetch = async (url, options = {}) => {
      const token = options.headers?.Authorization
      if (url.endsWith('/auth/me')) return json({ user: { id: token === 'Bearer notification-b' ? 'user-b' : 'user-a', name: token === 'Bearer notification-b' ? 'Bob' : 'Alice', email: 'person@example.com' } })
      if (url.endsWith('/applications')) return json([application])
      if (url.endsWith('/auth/login-activity')) return json({ activities: [] })
      if (url.endsWith('/notifications')) {
        notificationReads++
        if (defer) return new Promise(resolve => pending.push(() => resolve(responseFor(token))))
        return status === 200 ? responseFor(token) : json({ message: 'private diagnostic' }, status)
      }
      assert.match(url, /\/notifications\/(read-all|[a-f0-9]{24}\/read)$/)
      assert.equal(options.method, 'PATCH')
      assert.equal(token, 'Bearer notification-a')
      assert.equal(options.body, undefined)
      writes++
      return new Promise(resolve => { completeWrite = () => {
        const id = url.split('/').at(-2)
        items = items.map(item => url.endsWith('read-all') || item.id === id ? { ...item, read: true } : item)
        resolve(json({ message: 'ok' }))
      } })
    }
    await mount(null)
    assert.equal(bell(), null)
    assert.equal(notificationReads, 0)
    await mount('notification-a')
    assert.ok(bell())
    const storageBefore = [JSON.stringify(window.localStorage), JSON.stringify(window.sessionStorage)]
    await click(bell())
    assert.match(panel().textContent, /Loading notifications/)
    assert.equal(button('Mark all as read').disabled, true)
    await act(async () => { defer = false; pending.forEach(resolve => resolve()); pending = [] })
    assert.equal(container.querySelector('.notification-count').textContent, '2')
    assert.match(bell().getAttribute('aria-label'), /2 unread/)
    assert.equal(panel().querySelectorAll('.notification-unread').length, 2)
    assert.equal(panel().querySelectorAll('.notification-read').length, 1)
    assert.equal(panel().querySelectorAll('time').length, 3)
    assert.match(panel().textContent, /<script>Private Company A<\/script>/)
    assert.equal(panel().querySelector('script'), null)
    assert.equal(panel().querySelector('a').getAttribute('href'), `${base}applications/${applicationId}`)
    await act(async () => { button('Mark as read').click(); button('Mark as read').click() })
    assert.equal(writes, 1)
    assert.match(panel().textContent, /Updating notifications/)
    assert.equal(button('Mark all as read').disabled, true)
    await act(async () => completeWrite())
    assert.equal(container.querySelector('.notification-count').textContent, '1')
    assert.equal(panel().querySelectorAll('.notification-unread').length, 1)
    await click(button('Mark all as read'))
    await act(async () => completeWrite())
    assert.equal(writes, 2)
    assert.equal(container.querySelector('.notification-count'), null)
    assert.equal(panel().querySelectorAll('.notification-read').length, 3)
    await click(panel().querySelector('a'))
    assert.equal(window.location.pathname, `${base}applications/${applicationId}`)
    assert.equal(panel(), null)
    assert.match(container.querySelector('main').textContent, /Private Company A/)
    await click(bell())
    status = 500
    await click(button('Refresh notifications'))
    assert.match(panel().textContent, /Unable to load or update notifications/)
    assert.doesNotMatch(panel().textContent, /private diagnostic/)
    assert.ok(button('Retry notifications'))
    status = 200; items = []
    await click(button('Retry notifications'))
    assert.match(panel().textContent, /No notifications yet/)
    assert.deepEqual([JSON.stringify(window.localStorage), JSON.stringify(window.sessionStorage)], storageBefore)
    await act(async () => panel().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(panel(), null)
    assert.equal(document.activeElement, bell())
    // A response for an earlier account must not populate the new account panel.
    items = [{ id: '0123456789abcdef01234567', type: 'status', title: 'Private old account', message: 'Old private message', read: false, createdAt: '2026-10-22T01:00:00Z' }]
    defer = true
    await click(bell()); await click(button('Refresh notifications'))
    const oldResponses = pending; pending = []
    defer = false
    await mount('notification-b')
    await click(bell())
    await act(async () => oldResponses.forEach(resolve => resolve()))
    assert.match(panel().textContent, /No notifications yet/)
    assert.doesNotMatch(container.textContent, /Old private message|Private old account/)
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    await click([...container.querySelectorAll('.workspace-menu button')].find(node => node.textContent === 'Sign out'))
    assert.equal(bell(), null)
    assert.equal(panel(), null)
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
  } finally {
    if (root) await act(async () => root.unmount())
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    if (originalToken === null) window.sessionStorage.removeItem(TOKEN_KEY)
    else window.sessionStorage.setItem(TOKEN_KEY, originalToken)
    container.remove()
  }
  return 'PASS: authenticated notification bell/count, loading/list/read/empty/error/retry, mark one/all pending and duplicates, safe application navigation, escaped text, keyboard dismissal, no notification storage and logout/cross-account privacy'
}
