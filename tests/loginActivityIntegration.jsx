import assert from 'node:assert/strict'
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { TOKEN_KEY } from '../src/services/authSession'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const container = document.createElement('div')
  document.body.append(container)
  const base = import.meta.env.BASE_URL
  const users = {
    a: { id: 'activity-a', name: 'History User A', email: 'a@example.com', emailVerified: false },
    b: { id: 'activity-b', name: 'History User B', email: 'b@example.com', emailVerified: true },
  }
  const activities = [
    { id: 'newest', loggedInAt: '2026-10-20T12:00:00.000Z', ipAddress: '192.0.2.10', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36' },
    { id: 'older', loggedInAt: '2026-10-19T12:00:00.000Z', ipAddress: '192.0.2.11', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/18.0 Safari/605.1' },
    { id: 'unknown', loggedInAt: '2026-10-18T12:00:00.000Z', ipAddress: '', userAgent: '<img src=x onerror=alert(1)>' },
  ]
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
  let root, respond, activityRequests = 0, meRequests = 0, profileUpdates = 0, failure
  const panel = () => container.querySelector('[aria-labelledby="login-activity-heading"]')
  const button = text => [...container.querySelectorAll('button')].find(node => node.textContent === text)
  async function click(element) { assert.ok(element); await act(async () => element.click()) }
  async function render(path, strict = false) {
    if (root) await act(async () => root.unmount())
    window.history.replaceState({}, '', base + path)
    root = createRoot(container)
    await act(async () => root.render(strict ? <StrictMode><App /></StrictMode> : <App />))
  }
  async function input(name, value) {
    await act(async () => {
      const element = container.querySelector(`[name="${name}"]`)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/notifications')) return Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
      if (url.endsWith('/auth/login')) {
        const key = JSON.parse(options.body).email[0]
        return json({ user: users[key], accessToken: `activity-token-${key}` })
      }
      const key = options.headers?.Authorization?.slice(-1)
      if (url.endsWith('/auth/me')) {
        if (options.method === 'DELETE') return json({ message: 'Account deleted successfully.' })
        if (options.method === 'PATCH') { profileUpdates++; users[key] = { ...users[key], ...JSON.parse(options.body) } }
        else meRequests++
        return json({ user: users[key] })
      }
      if (url.endsWith('/applications')) return json([])
      assert.ok(url.endsWith('/auth/login-activity'))
      activityRequests++
      assert.deepEqual(options, { headers: { Authorization: `Bearer activity-token-${key}` } })
      if (failure === 'network') throw new Error('private network diagnostic')
      return new Promise(resolve => { respond = (items = activities, status = failure || 200) => resolve(json(status === 200 ? { activities: items.map(item => ({ ...item, password: 'private-password', token: 'private-token', user: 'private-owner' })) } : { message: 'private database diagnostic' }, status)) })
    }
    window.sessionStorage.clear()
    await render('profile')
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(panel(), null)
    assert.equal(activityRequests, 0)
    window.sessionStorage.setItem(TOKEN_KEY, 'activity-token-a')
    const sessionBefore = JSON.stringify(window.sessionStorage)
    const localBefore = JSON.stringify(window.localStorage)
    await render('profile', true)
    assert.match(container.textContent, /Recent Login Activity/)
    assert.match(panel().textContent, /Loading login activity.../)
    assert.equal(activityRequests, 1, 'StrictMode replays only subscribe to the same pending history request')
    assert.equal(panel().getAttribute('aria-busy'), 'true')
    assert.equal(button('Refreshing...').disabled, true)
    await click(button('Refreshing...'))
    assert.equal(activityRequests, 1)
    await act(async () => respond())
    const items = [...panel().querySelectorAll('li')]
    assert.deepEqual(items.map(item => item.querySelector('time').dateTime), activities.map(item => item.loggedInAt))
    assert.match(items[0].textContent, /Chrome on Windows/)
    assert.match(items[1].textContent, /Safari on macOS/)
    assert.match(items[2].textContent, /Unknown browser\/device/)
    assert.match(items[2].textContent, /IP address: Unavailable/)
    assert.equal(panel().querySelector('img'), null)
    assert.doesNotMatch(container.innerHTML, /private-password|private-token|private-owner|activity-token-a/)
    assert.equal(JSON.stringify(window.sessionStorage), sessionBefore)
    assert.equal(JSON.stringify(window.localStorage), localBefore)
    const meBefore = meRequests
    const beforeRefresh = activityRequests
    const refresh = button('Refresh')
    await click(refresh)
    await click(refresh)
    assert.equal(activityRequests, beforeRefresh + 1)
    assert.match(panel().textContent, /Loading login activity/)
    await act(async () => respond([]))
    assert.match(panel().textContent, /No login activity available/)
    assert.equal(meRequests, meBefore, 'History refresh must not reload the current user')
    failure = 500
    await click(button('Refresh'))
    await act(async () => respond())
    assert.match(panel().textContent, /Unable to load login activity/)
    assert.doesNotMatch(panel().textContent, /private .*diagnostic/)
    assert.match(container.textContent, /History User A/)
    // Profile edit remains functional while the history panel has an error.
    await click(button('Edit Profile'))
    await input('name', 'History User A Updated')
    await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(profileUpdates, 1)
    assert.match(container.textContent, /Profile updated successfully/)
    failure = 'network'
    await click(button('Retry'))
    assert.match(panel().textContent, /Unable to load login activity/)
    assert.match(container.textContent, /History User A Updated/)
    failure = null
    await click(button('Retry'))
    await act(async () => respond())
    assert.equal(panel().querySelectorAll('li').length, 3)
    const afterRetry = activityRequests
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    assert.equal(activityRequests, afterRetry, 'No continuous polling')
    // Logout clears the panel and ignores a late response for the old account.
    await click(button('Refresh'))
    const lateA = respond
    await click(button('Sign out'))
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(panel(), null)
    assert.doesNotMatch(container.textContent, /192.0.2.10|Chrome on Windows/)
    await input('email', users.b.email)
    await input('password', 'OtherPassword123')
    await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    await click(container.querySelector(`.workspace-menu a[href="${base}profile"]`))
    assert.match(panel().textContent, /Loading login activity/)
    await act(async () => lateA())
    assert.match(panel().textContent, /Loading login activity/)
    const bItem = { id: 'b-only', loggedInAt: '2026-10-20T13:00:00.000Z', ipAddress: '198.51.100.40', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/131.0' }
    await act(async () => respond([bItem]))
    assert.match(panel().textContent, /Firefox on Windows/)
    assert.match(panel().textContent, /198.51.100.40/)
    assert.doesNotMatch(panel().textContent, /192.0.2.10|Chrome on Windows/)
    await click(button('Delete Account'))
    await input('currentPassword', 'OtherPassword123')
    await act(async () => container.querySelector('form[aria-label="Delete account"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(panel(), null)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    assert.doesNotMatch(container.textContent, /198.51.100.40|History User B/)
    // Matching 401 still follows existing session-expiry cleanup.
    window.sessionStorage.setItem(TOKEN_KEY, 'activity-token-a')
    await render('profile')
    await act(async () => respond([], 401))
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    return 'PASS: login history loading/list/order/empty/error, conservative agent labels, refresh/retry/duplicate guard, StrictMode deduplication, usable Profile after failure, no storage/secrets, logout/deletion privacy, cross-account late-response isolation and 401 cleanup'
  } finally {
    if (root) await act(async () => root.unmount())
    window.sessionStorage.clear()
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    container.remove()
  }
}
