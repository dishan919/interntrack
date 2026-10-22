import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { installApi } from './apiMock'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const originalUrl = window.location.href
  const base = import.meta.env.BASE_URL
  const container = document.createElement('div')
  document.body.append(container)
  globalThis.localStorage = window.localStorage
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const record = { id: 'route-test', company: 'Example Company', position: 'Routing Intern', status: 'Saved' }
  installApi(new Map([['interntrack_applications', JSON.stringify([record])]]))
  const rest = globalThis.fetch
  globalThis.fetch = (url, options) => url.endsWith('/notifications')
    ? Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
    : url.endsWith('/auth/login-activity')
    ? Promise.resolve(new Response('{"activities":[]}'))
    : url.endsWith('/auth/me')
    ? Promise.resolve(new Response(JSON.stringify({ user: { id: 'route-user', name: 'Route User', email: 'route@example.com' } })))
    : rest(url, options)
  let root
  async function visit(path) {
    if (root) await act(async () => root.unmount())
    if (['register', 'login'].includes(path)) window.sessionStorage.removeItem('interntrack_access_token')
    else window.sessionStorage.setItem('interntrack_access_token', 'route-test-token')
    window.history.replaceState({}, '', `${base}${path}`)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  async function click(path) {
    const link = container.querySelector(`a[href="${base}${path}"]`)
    assert.ok(link, `Expected basename-aware link for ${path}`)
    await act(async () => link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    assert.equal(window.location.pathname, `${base}${path}`)
  }
  try {
    for (const [path, heading] of [
      ['', 'Track your applications.'], ['register', 'Create your account'], ['login', 'Sign in to InternTrack'],
      ['applications', 'Applications'], ['applications/new', 'Add application'],
      ['applications/route-test', 'Routing Intern'], ['applications/route-test/edit', 'Edit application'],
      ['companies', 'Companies'], ['statistics', 'Statistics'], ['settings', 'Settings'], ['profile', 'Profile'],
    ]) {
      await visit(path)
      assert.ok(container.querySelector('h1')?.textContent.includes(heading), `Route ${base}${path} should show ${heading}`)
      assert.doesNotMatch(container.textContent, /Page not found/)
    }
    await visit('register')
    await click('login')
    assert.equal(container.querySelector('h1').textContent, 'Sign in to InternTrack')
    await click('register')
    assert.equal(container.querySelector('h1').textContent, 'Create your account')
    await visit('')
    await click('applications')
    assert.equal(container.querySelector('h1').textContent, 'Applications')
    await click('applications/route-test')
    assert.equal(container.querySelector('h1').textContent, 'Routing Intern')
    await click('applications/route-test/edit')
    assert.equal(container.querySelector('h1').textContent, 'Edit application')
    await click('')
    assert.match(container.querySelector('h1').textContent, /Track your applications/)
    return `PASS: basename ${base} resolves all existing routes, registration, and root/list/detail/edit internal navigation`
  } finally {
    if (root) await act(async () => root.unmount())
    container.remove()
    window.sessionStorage.removeItem('interntrack_access_token')
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
    window.history.replaceState({}, '', originalUrl)
  }
}
