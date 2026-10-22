import assert from 'node:assert/strict'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import AuthProvider from '../src/context/AuthProvider'
import { useAuth } from '../src/context/AuthContext'
import ApplicationProvider from '../src/context/ApplicationProvider'
import { useApplications } from '../src/context/ApplicationContext'
import { TOKEN_KEY, getAccessToken } from '../src/services/authSession'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const container = document.createElement('div')
  document.body.append(container)
  const base = import.meta.env.BASE_URL
  const users = {
    a: { id: 'delete-a', name: 'Private User A', email: 'a@example.com', emailVerified: false },
    b: { id: 'delete-b', name: 'Private User B', email: 'b@example.com', emailVerified: true },
    c: { id: 'delete-c', name: 'Private User C', email: 'c@example.com', emailVerified: true },
  }
  const records = key => [{ id: `application-${key}`, company: `Private Company ${key.toUpperCase()}`, position: 'Intern', status: 'Saved' }]
  let root, respond, failure, deletedA = false, deletes = 0, applicationGets = 0, auth, apps
  const password = ' CurrentPassword123 '
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
  const form = () => container.querySelector('form[aria-label="Delete account"]')
  const button = text => [...container.querySelectorAll('button')].find(node => node.textContent === text)
  async function click(element) { assert.ok(element); await act(async () => element.click()) }
  async function input(name, value, parent = container) {
    await act(async () => {
      const element = parent.querySelector(`[name="${name}"]`)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  async function submit() { await act(async () => form().dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
  async function unmount() { if (root) { await act(async () => root.unmount()); root = null } }
  async function mount(path) {
    await unmount()
    window.history.replaceState({}, '', base + path)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  function AuthProbe() {
    const context = useAuth()
    useEffect(() => { auth = context })
    return <span>{context.user?.name || 'Signed out'}</span>
  }
  function AppsProbe() {
    const context = useApplications()
    useEffect(() => { apps = context })
    return <span>{context.applications.map(record => record.company).join(',')}</span>
  }
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/notifications')) return Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
      if (url.endsWith('/auth/login-activity')) return new Response('{"activities":[]}')
      if (url.endsWith('/auth/login')) {
        const key = JSON.parse(options.body).email[0]
        return json({ user: users[key], accessToken: `token-${key}` })
      }
      const key = options.headers?.Authorization?.slice(-1)
      if (url.endsWith('/applications')) { applicationGets++; return json(records(key)) }
      assert.ok(url.endsWith('/auth/me'))
      if (options.method !== 'DELETE') return deletedA && key === 'a' ? json({ message: 'Unauthorized' }, 401) : json({ user: users[key] })
      deletes++
      assert.equal(options.method, 'DELETE')
      assert.deepEqual(JSON.parse(options.body), { currentPassword: password })
      assert.equal(options.headers['Content-Type'], 'application/json')
      if (failure === 'network') throw new Error('private network diagnostic')
      if (failure) return json({ message: failure === 400 ? 'Current password is incorrect.' : 'private database diagnostic' }, failure)
      return new Promise(resolve => { respond = () => { if (key === 'a') deletedA = true; resolve(json({ message: 'Account deleted successfully.' })) } })
    }
    window.sessionStorage.setItem(TOKEN_KEY, 'token-a')
    const localBefore = JSON.stringify(window.localStorage)
    await mount('profile')
    assert.match(container.textContent, /Danger Zone/)
    assert.equal(form(), null)
    await click(button('Delete Account'))
    assert.ok(form())
    assert.match(container.textContent, /permanently removes your account and all your applications/)
    assert.equal(deletes, 0)
    assert.equal(form().elements.namedItem('currentPassword').type, 'password')
    await submit()
    assert.match(form().textContent, /Current password is required/)
    assert.equal(deletes, 0)
    const visibility = form().querySelector('[aria-controls="delete-current-password"]')
    assert.equal(visibility.type, 'button')
    await click(visibility)
    assert.equal(form().elements.namedItem('currentPassword').type, 'text')
    assert.equal(visibility.getAttribute('aria-label'), 'Hide current password')
    await click(visibility)
    assert.equal(form().elements.namedItem('currentPassword').type, 'password')
    assert.equal(deletes, 0)
    await input('currentPassword', password, form())
    await click(button('Cancel'))
    assert.equal(form(), null)
    assert.equal(deletes, 0)
    await click(button('Delete Account'))
    assert.equal(form().elements.namedItem('currentPassword').value, '')
    assert.equal(form().elements.namedItem('currentPassword').type, 'password')
    await input('currentPassword', password, form())
    const loaded = applicationGets
    for (const [status, message] of [[400, /Current password is incorrect/], ['network', /Check your connection/], [500, /Unable to delete your account/]]) {
      failure = status
      await submit()
      assert.match(form().querySelector('[role="alert"]').textContent, message)
      assert.doesNotMatch(container.textContent, /private .*diagnostic/)
      assert.match(container.textContent, /Private User A/)
      assert.equal(window.sessionStorage.getItem(TOKEN_KEY), 'token-a')
    }
    await click(container.querySelector(`a[href="${base}applications"]`))
    assert.match(container.textContent, /Private Company A/)
    assert.equal(applicationGets, loaded, 'Failed deletion retains existing application state')
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    await click(container.querySelector(`.workspace-menu a[href="${base}profile"]`))
    await click(button('Delete Account'))
    await input('currentPassword', password, form())
    failure = null
    const before = deletes
    await submit()
    assert.equal(form().getAttribute('aria-busy'), 'true')
    assert.match(form().textContent, /Deleting.../)
    for (const element of form().querySelectorAll('input, button')) assert.equal(element.disabled, true)
    assert.ok(button('Edit Profile').matches(':disabled'))
    assert.ok(button('Change Password').matches(':disabled'))
    assert.ok(button('Resend Verification').matches(':disabled'))
    await submit()
    assert.equal(deletes, before + 1)
    await act(async () => respond())
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    assert.equal(getAccessToken(), null)
    assert.doesNotMatch(container.textContent, /Private User A|Private Company A|Danger Zone/)
    assert.equal(container.querySelector('[name="password"]').value, '')
    assert.equal(JSON.stringify(window.localStorage), localBefore)
    await input('email', users.b.email)
    await input('password', 'OtherPassword456')
    await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(window.location.pathname, base)
    assert.match(container.textContent, /Private Company B/)
    assert.doesNotMatch(container.textContent, /Private Company A|Private User A/)
    // Direct provider probe verifies cleared user/apps and stale-session response guards.
    await unmount()
    root = createRoot(container)
    await act(async () => root.render(<AuthProvider><AuthProbe /><ApplicationProvider><AppsProbe /></ApplicationProvider></AuthProvider>))
    assert.equal(auth.user.id, users.b.id)
    assert.equal(apps.applications[0].company, 'Private Company B')
    let deleting
    await act(async () => { deleting = auth.deleteAccount(password) })
    const late = respond
    await act(async () => auth.logout())
    assert.equal(auth.user, null)
    assert.equal(auth.isAuthenticated, false)
    assert.doesNotMatch(container.textContent, /Private Company B/)
    await act(async () => auth.login({ email: users.c.email, password: 'AnotherPassword789' }))
    await act(async () => { late(); await deleting })
    assert.equal(auth.user.id, users.c.id)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), 'token-c')
    assert.equal(apps.applications[0].company, 'Private Company C')
    assert.doesNotMatch(container.textContent, /Private Company B/)
    // A completed deletion clears the current provider itself, not just its route.
    await act(async () => { deleting = auth.deleteAccount(password) })
    await act(async () => { respond(); await deleting })
    assert.equal(auth.user, null)
    assert.equal(auth.accessToken, null)
    assert.equal(auth.isAuthenticated, false)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    assert.doesNotMatch(container.textContent, /Private Company C/)
    // Invalid/expired/missing-account 401 follows existing session cleanup.
    deletedA = false
    window.sessionStorage.setItem(TOKEN_KEY, 'token-a')
    await mount('profile')
    await click(button('Delete Account'))
    await input('currentPassword', password, form())
    failure = 401
    await submit()
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    return 'PASS: Danger Zone confirmation/cancel, required exact password, accessible visibility, safe errors with retained user/apps, disabled conflicting controls/duplicates, successful session/private-state cleanup and public redirect, account isolation and stale-response guards'
  } finally {
    await unmount()
    window.sessionStorage.clear()
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    container.remove()
  }
}
