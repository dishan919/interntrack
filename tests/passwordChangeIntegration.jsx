import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { TOKEN_KEY } from '../src/services/authSession'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const container = document.createElement('div')
  document.body.append(container)
  let root, respond, failure
  let requests = 0
  const token = 'password-ui-test-token'
  const user = { id: 'password-user', name: 'Security User', email: 'security@example.com' }
  const values = { currentPassword: 'CurrentPassword123', newPassword: ' NewPassword123 ', confirmNewPassword: ' NewPassword123 ' }
  const base = import.meta.env.BASE_URL
  const form = () => container.querySelector('form[aria-label="Change password"]')
  const button = text => [...container.querySelectorAll('button')].find(node => node.textContent === text)
  async function click(element) { assert.ok(element); await act(async () => element.click()) }
  async function input(name, value) {
    await act(async () => {
      const element = form().elements.namedItem(name)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  async function submit() { await act(async () => form().dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token)
    const sessionBefore = JSON.stringify(window.sessionStorage)
    const localBefore = JSON.stringify(window.localStorage)
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/notifications')) return Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
      if (url.endsWith('/auth/login-activity')) return new Response('{"activities":[]}')
      if (url.endsWith('/auth/me')) return new Response(JSON.stringify({ user }))
      if (url.endsWith('/applications')) return new Response('[]')
      assert.ok(url.endsWith('/auth/password'))
      requests++
      assert.equal(options.method, 'PATCH')
      assert.equal(options.headers.Authorization, `Bearer ${token}`)
      assert.deepEqual(JSON.parse(options.body), { currentPassword: values.currentPassword, newPassword: values.newPassword })
      if (failure === 'network') throw new Error('private diagnostic')
      if (failure) return new Response(JSON.stringify({ message: failure === 400 ? 'Current password is incorrect.' : 'private diagnostic' }), { status: failure })
      return new Promise(resolve => { respond = () => resolve(new Response('{"message":"Password changed successfully."}')) })
    }
    window.history.replaceState({}, '', `${base}profile`)
    root = createRoot(container)
    await act(async () => root.render(<App />))
    assert.match(container.textContent, /Security/)
    await click(button('Change Password'))
    for (const key of Object.keys(values)) assert.equal(form().elements.namedItem(key).type, 'password')
    await submit()
    assert.equal(form().querySelectorAll('[role="alert"]').length, 3)
    assert.equal(requests, 0)
    await input('currentPassword', values.currentPassword)
    await input('newPassword', 'short')
    await input('confirmNewPassword', 'different')
    await submit()
    assert.match(form().textContent, /at least 8 characters/)
    assert.match(form().textContent, /Passwords must match/)
    await input('newPassword', values.currentPassword)
    await input('confirmNewPassword', values.currentPassword)
    await submit()
    assert.match(form().textContent, /must be different/)
    assert.equal(requests, 0)
    for (const [key, value] of Object.entries(values)) await input(key, value)
    for (const key of Object.keys(values)) {
      const control = form().querySelector(`[aria-controls="security-${key}"]`)
      assert.equal(control.type, 'button')
      assert.equal(control.tabIndex, 0)
      assert.match(control.getAttribute('aria-label'), /^Show /)
      await click(control)
      assert.equal(form().elements.namedItem(key).type, 'text')
      assert.match(control.getAttribute('aria-label'), /^Hide /)
      for (const other of Object.keys(values).filter(item => item !== key)) assert.equal(form().elements.namedItem(other).type, 'password')
      await click(control)
      assert.equal(form().elements.namedItem(key).type, 'password')
      assert.equal(requests, 0, 'Visibility controls never submit')
    }
    for (const [status, message] of [[400, /Current password is incorrect/], ['network', /Check your connection/], [500, /Unable to change your password/]]) {
      failure = status
      await submit()
      assert.match(form().querySelector('[role="alert"]').textContent, message)
      assert.doesNotMatch(container.textContent, /private diagnostic/)
      assert.equal(window.sessionStorage.getItem(TOKEN_KEY), token)
    }
    failure = null
    const beforeSave = requests
    await click(form().querySelector('[aria-controls="security-newPassword"]'))
    await submit()
    assert.equal(form().getAttribute('aria-busy'), 'true')
    assert.match(form().textContent, /Changing password/)
    for (const control of form().querySelectorAll('input, button')) assert.equal(control.disabled, true)
    await submit()
    assert.equal(requests, beforeSave + 1)
    await act(async () => respond())
    assert.match(form().textContent, /Password changed successfully/)
    for (const key of Object.keys(values)) {
      assert.equal(form().elements.namedItem(key).value, '')
      assert.equal(form().elements.namedItem(key).type, 'password')
    }
    assert.equal(JSON.stringify(window.sessionStorage), sessionBefore)
    assert.equal(JSON.stringify(window.localStorage), localBefore)
    assert.match(container.textContent, /Security User/)
    assert.ok(!container.innerHTML.includes(token))
    for (const value of Object.values(values)) assert.ok(!container.innerHTML.includes(value))
    // Existing session can navigate the protected workspace after success.
    await click(container.querySelector(`a[href="${base}applications"]`))
    assert.equal(window.location.pathname, `${base}applications`)
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    await click(container.querySelector(`a[href="${base}profile"]`))
    await click(button('Change Password'))
    for (const [key, value] of Object.entries(values)) await input(key, value)
    failure = 401
    await submit()
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    return 'PASS: password UI required/policy/confirmation/same-password validation, independent visibility, exact payload, safe errors, pending/duplicate guard, cleared hidden fields, no password storage, usable session and 401 cleanup'
  } finally {
    if (root) await act(async () => root.unmount())
    window.sessionStorage.removeItem(TOKEN_KEY)
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    container.remove()
  }
}
