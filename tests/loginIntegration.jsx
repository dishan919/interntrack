import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const base = import.meta.env.BASE_URL
  window.history.replaceState({}, '', `${base}login`)
  const container = document.createElement('div')
  document.body.append(container)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const storageBefore = [JSON.stringify(window.localStorage), JSON.stringify(window.sessionStorage)]
  const calls = []
  let respond
  globalThis.fetch = (url, options) => {
    calls.push({ url, options })
    return new Promise(resolve => { respond = resolve })
  }
  let root
  async function mount() {
    if (root) await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  async function input(name, value) {
    const element = container.querySelector(`[name="${name}"]`)
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  async function submit() {
    await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  }
  try {
    await mount()
    assert.match(container.querySelector('h1').textContent, /Sign in to InternTrack/)
    assert.equal(calls.length, 0, 'Public login must not fetch protected applications')
    assert.ok(container.querySelector(`a[href="${base}register"]`))
    for (const name of ['email', 'password']) {
      const element = container.querySelector(`[name="${name}"]`)
      assert.ok(container.querySelector(`label[for="${element.id}"]`))
    }
    assert.equal(container.querySelector('[name="password"]').autocomplete, 'current-password')
    await submit()
    assert.equal(container.querySelectorAll('[aria-invalid="true"]').length, 2)
    assert.equal(document.activeElement.name, 'email')
    await input('email', 'invalid')
    await input('password', 'short')
    await submit()
    assert.match(container.textContent, /valid email/)
    assert.match(container.textContent, /at least 8/)
    assert.equal(calls.length, 0)
    await input('email', ' user@example.com ')
    await input('password', ' Password123 ')
    const password = container.querySelector('[name="password"]')
    assert.equal(password.type, 'password')
    for (const [label, expected] of [['Show password', 'text'], ['Hide password', 'password']]) {
      const button = container.querySelector(`[aria-label="${label}"]`)
      assert.equal(button.type, 'button')
      assert.equal(button.tabIndex, 0)
      await act(async () => button.click())
      assert.equal(password.type, expected)
      assert.equal(password.value, ' Password123 ')
      assert.equal(calls.length, 0)
    }
    await submit()
    assert.match(container.textContent, /Signing in/)
    assert.equal(container.querySelector('form').getAttribute('aria-busy'), 'true')
    for (const control of container.querySelectorAll('input, button')) assert.equal(control.disabled, true)
    await submit()
    assert.equal(calls.length, 1)
    assert.ok(calls[0].url.endsWith('/auth/login'))
    assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'user@example.com', password: ' Password123 ' })
    await act(async () => respond(new Response('private internals', { status: 401 })))
    assert.match(container.querySelector('[role="alert"]').textContent, /Invalid email or password/)
    assert.doesNotMatch(container.textContent, /private internals/)
    assert.equal(container.querySelector('button[type="submit"]').disabled, false)
    globalThis.fetch = async () => { throw new Error('private diagnostic') }
    await submit()
    assert.match(container.querySelector('[role="alert"]').textContent, /Check your connection/)
    assert.doesNotMatch(container.textContent, /private diagnostic/)
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/notifications')) return Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
      if (url.endsWith('/applications')) {
        assert.equal(options.headers.Authorization, 'Bearer never-display-test-token')
        return new Response('[]')
      }
      return new Response(JSON.stringify({ user: { id: 'test-id', name: 'Example User', email: 'user@example.com' }, accessToken: 'never-display-test-token' }))
    }
    await submit()
    assert.match(container.querySelector('h1').textContent, /Track your applications/)
    assert.equal(container.querySelector('input[name="password"]'), null)
    assert.doesNotMatch(container.innerHTML, /never-display-test-token|Password123/)
    assert.equal(window.location.pathname, base, 'Login redirects to dashboard with basename')
    assert.equal(window.sessionStorage.getItem('interntrack_access_token'), 'never-display-test-token')
    assert.equal(JSON.stringify(window.localStorage), storageBefore[0])
    assert.doesNotMatch(JSON.stringify(window.sessionStorage), /Password123|user@example.com/)
    await act(async () => container.querySelector('[aria-label="Student Workspace"]').click())
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Sign out').click())
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem('interntrack_access_token'), null)
    assert.equal(container.querySelector('[name="password"]').value, '')
    assert.equal(container.querySelector('[name="password"]').type, 'password')
    return 'PASS: public login, validation, accessible Show/Hide, exact payload, loading/duplicate guard, safe errors, session token only, dashboard redirect and logout cleanup'
  } finally {
    if (root) await act(async () => root.unmount())
    container.remove()
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
  }
}
