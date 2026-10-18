import assert from 'node:assert/strict'
import { StrictMode, act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import AuthProvider from '../src/context/AuthProvider'
import { useAuth } from '../src/context/AuthContext'
import ApplicationProvider from '../src/context/ApplicationProvider'
import { useApplications } from '../src/context/ApplicationContext'
import { TOKEN_KEY, getAccessToken } from '../src/services/authSession'

const users = { a: { id: 'user-a', name: 'User A', email: 'a@example.com' }, b: { id: 'user-b', name: 'User B', email: 'b@example.com' } }
const records = { a: [{ id: 'application-a', company: 'Private Company A', position: 'Intern', status: 'Saved' }], b: [{ id: 'application-b', company: 'Private Company B', position: 'Intern', status: 'Saved' }] }
const json = data => new Response(JSON.stringify(data))

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const container = document.createElement('div')
  document.body.append(container)
  const base = import.meta.env.BASE_URL
  let root, auth, applications
  const calls = []
  let deferredMe, deferredApplications, deferMe = false, deferApplications = false, failApplications = false
  function install() {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options })
      if (url.endsWith('/auth/login')) {
        const body = JSON.parse(options.body)
        const key = body.email.startsWith('b') ? 'b' : 'a'
        return json({ user: users[key], accessToken: `token-${key}` })
      }
      if (url.endsWith('/auth/me')) {
        if (deferMe) return new Promise(resolve => { deferredMe = resolve })
        const key = options.headers.Authorization === 'Bearer token-b' ? 'b' : 'a'
        if (options.headers.Authorization === 'Bearer invalid') return new Response('private', { status: 401 })
        return json({ user: users[key] })
      }
      assert.ok(url.includes('/applications'))
      if (failApplications) return new Response('private', { status: 401 })
      if (deferApplications) return new Promise(resolve => { deferredApplications = resolve })
      assert.ok(['Bearer token-a', 'Bearer token-b'].includes(options.headers.Authorization))
      return json(records[options.headers.Authorization.endsWith('b') ? 'b' : 'a'])
    }
  }
  function AuthProbe() {
    const value = useAuth()
    useEffect(() => { auth = value })
    return <span>{value.isAuthLoading ? 'Checking authentication' : value.user?.name || 'Signed out'}</span>
  }
  function ApplicationProbe() {
    const value = useApplications()
    useEffect(() => { applications = value })
    return <div>{value.applications.map(record => record.company).join(',')}</div>
  }
  async function unmount() { if (root) { await act(async () => root.unmount()); root = null } }
  async function mountProbe() {
    await unmount()
    auth = null
    applications = null
    root = createRoot(container)
    await act(async () => root.render(<AuthProvider><AuthProbe /><ApplicationProvider><ApplicationProbe /></ApplicationProvider></AuthProvider>))
  }
  async function mountApp(path) {
    await unmount()
    window.history.replaceState({}, '', `${base}${path}`)
    root = createRoot(container)
    await act(async () => root.render(<StrictMode><App /></StrictMode>))
  }
  try {
    install()
    window.sessionStorage.clear()
    await mountProbe()
    assert.equal(auth.isAuthenticated, false)
    assert.equal(auth.isAuthLoading, false)
    assert.equal(auth.user, null)
    assert.equal(auth.accessToken, null)
    assert.equal(calls.length, 0)
    assert.equal(applications, null)

    await act(async () => auth.login({ email: users.a.email, password: 'Password123' }))
    assert.deepEqual(auth.user, users.a)
    assert.equal(auth.accessToken, 'token-a')
    assert.equal(auth.isAuthenticated, true)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), 'token-a')
    assert.equal(window.sessionStorage.length, 1)
    assert.doesNotMatch(JSON.stringify(window.sessionStorage), /Password123|example.com/)
    assert.equal(applications.applications[0].id, 'application-a')
    assert.match(container.textContent, /Private Company A/)

    // Unmounting/remounting verifies through /me instead of trusting a stored user.
    deferMe = true
    const beforeRestore = calls.length
    await mountProbe()
    assert.equal(auth.isAuthLoading, true)
    assert.equal(auth.isAuthenticated, false)
    assert.equal(auth.user, null)
    assert.equal(applications, null)
    assert.doesNotMatch(container.textContent, /Private Company/)
    assert.equal(calls.length, beforeRestore + 1)
    assert.ok(calls.at(-1).url.endsWith('/auth/me'))
    assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer token-a')
    deferMe = false
    await act(async () => deferredMe(json({ user: users.a })))
    assert.equal(auth.isAuthenticated, true)
    assert.equal(applications.applications[0].id, 'application-a')

    // Logout immediately hides old data, even if an application reload finishes later.
    deferApplications = true
    let reload
    await act(async () => { reload = applications.reloadApplications() })
    const lateApplications = deferredApplications
    await act(async () => auth.logout())
    assert.equal(auth.user, null)
    assert.equal(auth.accessToken, null)
    assert.equal(auth.isAuthenticated, false)
    assert.equal(getAccessToken(), null)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    assert.doesNotMatch(container.textContent, /Private Company A/)
    deferApplications = false
    await act(async () => auth.login({ email: users.b.email, password: 'Password456' }))
    assert.match(container.textContent, /Private Company B/)
    await act(async () => { lateApplications(json(records.a)); await reload })
    assert.doesNotMatch(container.textContent, /Private Company A/)
    assert.equal(applications.applications[0].id, 'application-b')

    // A restore finishing after logout must not resurrect its user or token.
    deferMe = true
    await mountProbe()
    const lateRestore = deferredMe
    await act(async () => auth.logout())
    deferMe = false
    await act(async () => lateRestore(json({ user: users.b })))
    assert.equal(auth.isAuthenticated, false)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)

    window.sessionStorage.setItem(TOKEN_KEY, 'invalid')
    await mountProbe()
    assert.equal(auth.isAuthenticated, false)
    assert.equal(auth.user, null)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)

    // All workspace paths are private. Public pages cause no protected API calls.
    window.sessionStorage.clear()
    calls.length = 0
    for (const path of ['', 'applications', 'applications/new', 'applications/id', 'applications/id/edit', 'companies', 'statistics', 'settings', 'profile']) {
      await mountApp(path)
      assert.equal(window.location.pathname, `${base}login`)
      assert.match(container.querySelector('h1').textContent, /Sign in to InternTrack/)
    }
    await mountApp('register')
    assert.match(container.querySelector('h1').textContent, /Create your account/)
    assert.equal(calls.length, 0)

    // No private content during restoration; a verified login route goes to dashboard.
    window.sessionStorage.setItem(TOKEN_KEY, 'token-a')
    await mountApp('login')
    assert.equal(window.location.pathname, base)
    assert.match(container.textContent, /Private Company A/)
    assert.doesNotMatch(container.textContent, /Sign in to InternTrack/)

    failApplications = true
    await mountApp('applications')
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    assert.doesNotMatch(container.textContent, /Private Company A|Private Company B/)
    failApplications = false

    window.sessionStorage.setItem(TOKEN_KEY, 'invalid')
    await mountApp('')
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    return 'PASS: AuthProvider login/restore/logout, token-only storage, loading/privacy guards, account isolation, stale response cancellation, all private routes, already-signed-in login and application 401 cleanup'
  } finally {
    await unmount()
    window.sessionStorage.clear()
    container.remove()
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
  }
}
