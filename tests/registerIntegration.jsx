import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const dom = new JSDOM('<div id="root"></div>', { url: `http://localhost${import.meta.env.BASE_URL}register` })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.getElementById('root')
  let root
  const calls = []
  let respond
  globalThis.fetch = (url, options) => {
    calls.push({ url, options })
    return new Promise(resolve => { respond = resolve })
  }
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
  async function fill() {
    for (const [name, value] of Object.entries({ name: ' Test User ', email: 'test@example.com', password: 'Password123', confirmPassword: 'Password123' })) await input(name, value)
  }
  async function submit() {
    await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  }
  try {
    await mount()
    assert.match(container.textContent, /Create your account/)
    assert.equal(calls.length, 0, 'Public registration must not fetch protected applications')
    for (const name of ['name', 'email', 'password', 'confirmPassword']) {
      const element = container.querySelector(`[name="${name}"]`)
      assert.ok(container.querySelector(`label[for="${element.id}"]`))
      assert.ok(element.autocomplete)
    }
    assert.equal(container.querySelector('[name="password"]').type, 'password')
    assert.equal(container.querySelector('[name="confirmPassword"]').type, 'password')
    assert.ok(container.querySelector(`a[href="${import.meta.env.BASE_URL}login"]`))
    await submit()
    assert.equal(container.querySelectorAll('[aria-invalid="true"]').length, 4)
    assert.equal(document.activeElement.name, 'name')
    assert.equal(calls.length, 0)
    await fill()
    await input('email', 'invalid')
    await input('password', 'short')
    await input('confirmPassword', 'mismatch')
    await submit()
    assert.match(container.textContent, /valid email/)
    assert.match(container.textContent, /at least 8/)
    assert.match(container.textContent, /Passwords must match/)
    assert.equal(calls.length, 0)
    await fill()
    // Real native button activation must toggle independently without submitting.
    let submits = 0
    container.querySelector('form').addEventListener('submit', () => { submits++ })
    async function toggle(label) {
      const button = container.querySelector(`button[aria-label="${label}"]`)
      assert.ok(button)
      assert.equal(button.type, 'button')
      assert.equal(button.tabIndex, 0)
      await act(async () => button.click())
    }
    const password = container.querySelector('[name="password"]')
    const confirmation = container.querySelector('[name="confirmPassword"]')
    await toggle('Show password')
    assert.equal(password.type, 'text')
    assert.equal(confirmation.type, 'password')
    await toggle('Show confirm password')
    assert.equal(password.type, 'text')
    assert.equal(confirmation.type, 'text')
    await toggle('Hide password')
    assert.equal(password.type, 'password')
    assert.equal(confirmation.type, 'text')
    await toggle('Hide confirm password')
    assert.equal(confirmation.type, 'password')
    assert.equal(password.value, 'Password123')
    assert.equal(confirmation.value, 'Password123')
    assert.equal(submits, 0)
    assert.equal(calls.length, 0)
    await submit()
    assert.equal(container.querySelector('button[type="submit"]').disabled, true)
    assert.match(container.textContent, /Creating account/)
    await submit()
    assert.equal(calls.length, 1)
    assert.ok(calls[0].url.endsWith('/auth/register'))
    assert.deepEqual(JSON.parse(calls[0].options.body), { name: 'Test User', email: 'test@example.com', password: 'Password123' })
    await act(async () => respond(new Response(JSON.stringify({ user: { id: 'test-id', name: 'Test User', email: 'test@example.com' } }), { status: 201 })))
    assert.match(container.textContent, /Account created successfully/)
    assert.equal(container.querySelector('input[type="password"]'), null)
    assert.equal(window.localStorage.length, 0)
    assert.equal(window.sessionStorage.length, 0)
    assert.equal(calls.length, 1, 'Registration must not call login')
    await mount()
    await fill()
    await submit()
    await act(async () => respond(new Response('{"message":"private internals"}', { status: 409 })))
    assert.match(container.querySelector('[role="alert"]').textContent, /account with this email already exists/)
    assert.doesNotMatch(container.textContent, /private internals/)
    assert.equal(container.querySelector('button[type="submit"]').disabled, false)
    globalThis.fetch = async () => { throw new Error('private network diagnostic') }
    await submit()
    assert.match(container.querySelector('[role="alert"]').textContent, /Check your connection/)
    assert.doesNotMatch(container.textContent, /private network diagnostic/)
    return 'PASS: public register route, accessible fields, independent Show/Hide controls without submission, validation, exact API payload, duplicate-submit guard, success without login/storage, safe duplicate and network errors'
  } finally {
    if (root) await act(async () => root.unmount())
    globalThis.fetch = originalFetch
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    dom.window.close()
  }
}
