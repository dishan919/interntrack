import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { RESET_REQUEST_MESSAGE, RESET_SUCCESS_MESSAGE } from '../src/services/authService'
export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const container = document.createElement('div')
  document.body.append(container)
  const base = import.meta.env.BASE_URL
  const token = 'b'.repeat(64)
  let root, respond
  const requests = []
  const session = JSON.stringify(window.sessionStorage)
  const local = JSON.stringify(window.localStorage)
  async function render(path) {
    if (root) await act(async () => root.unmount())
    window.history.replaceState({}, '', base + path)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  async function input(name, value) {
    await act(async () => {
      const element = container.querySelector(`[name="${name}"]`)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  async function submit() { await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) })
      return new Promise(resolve => { respond = () => resolve(new Response('{}')) })
    }
    await render('login')
    assert.equal(container.querySelector(`a[href="${base}forgot-password"]`).textContent, 'Forgot password?')
    await render('forgot-password')
    await submit()
    assert.match(container.textContent, /Email is required/)
    await input('email', 'invalid')
    await submit()
    assert.match(container.textContent, /valid email/)
    assert.equal(requests.length, 0)
    for (const email of ['known@example.com', 'unknown@example.com']) {
      await input('email', email)
      const before = requests.length
      await submit()
      assert.equal(container.querySelector('form').getAttribute('aria-busy'), 'true')
      await submit()
      assert.equal(requests.length, before + 1)
      await act(async () => respond())
      assert.equal(container.querySelector('[role="status"]').textContent, RESET_REQUEST_MESSAGE)
    }
    await render('reset-password')
    assert.match(container.textContent, /invalid or has expired/)
    assert.equal(container.querySelector('form'), null)
    await render(`reset-password?token=${token}`)
    await submit()
    assert.equal(container.querySelectorAll('[role="alert"]').length, 2)
    await input('newPassword', 'short')
    await input('confirmNewPassword', 'different')
    await submit()
    assert.match(container.textContent, /at least 8/)
    assert.match(container.textContent, /Passwords must match/)
    for (const name of ['newPassword', 'confirmNewPassword']) {
      await input(name, 'NewPassword123')
      const button = container.querySelector(`[aria-controls="reset-${name}"]`)
      await act(async () => button.click())
      assert.equal(container.querySelector(`[name="${name}"]`).type, 'text')
      assert.match(button.getAttribute('aria-label'), /^Hide/)
      await act(async () => button.click())
      assert.equal(container.querySelector(`[name="${name}"]`).type, 'password')
    }
    const before = requests.length
    await submit()
    await submit()
    assert.equal(requests.length, before + 1)
    assert.deepEqual(requests.at(-1).body, { token, newPassword: 'NewPassword123' })
    await act(async () => respond())
    assert.match(container.textContent, new RegExp(RESET_SUCCESS_MESSAGE))
    assert.equal(container.querySelector('input'), null)
    assert.equal(window.location.search, '')
    assert.ok(container.querySelector(`a[href="${base}login"]`))
    assert.ok(!container.innerHTML.includes(token))
    assert.equal(JSON.stringify(window.sessionStorage), session)
    assert.equal(JSON.stringify(window.localStorage), local)
    return 'PASS: reset public routes, validation, visibility, generic success, pending duplicate guards, exact payload, cleared fields/URL, login link and no storage'
  } finally {
    if (root) await act(async () => root.unmount())
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    container.remove()
  }
}
