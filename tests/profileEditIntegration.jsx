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
  const base = import.meta.env.BASE_URL
  let root, respond, failure
  let user = { id: 'edit-user', name: 'Original Name', email: 'original@example.com' }
  let patches = 0
  const token = 'never-render-profile-edit-token'
  async function mount() {
    if (root) await act(async () => root.unmount())
    window.history.replaceState({}, '', `${base}profile`)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  const button = label => [...container.querySelectorAll('button')].find(node => node.textContent === label)
  async function click(element) { assert.ok(element); await act(async () => element.click()) }
  async function input(name, value) {
    await act(async () => {
      const element = container.querySelector(`[name="${name}"]`)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  async function submit() { await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token)
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/auth/login-activity')) return new Response('{"activities":[]}')
      if (url.endsWith('/applications')) return new Response('[]')
      assert.ok(url.endsWith('/auth/me'))
      if (options.method !== 'PATCH') return new Response(JSON.stringify({ user }))
      patches++
      assert.equal(options.headers.Authorization, `Bearer ${token}`)
      assert.equal(options.headers['Content-Type'], 'application/json')
      const updates = JSON.parse(options.body)
      assert.deepEqual(Object.keys(updates).sort(), ['email', 'name'])
      if (failure === 'network') throw new Error('private diagnostic')
      if (failure) return new Response('private diagnostic', { status: failure })
      return new Promise(resolve => { respond = () => { user = { ...user, ...updates, email: updates.email.toLowerCase() }; resolve(new Response(JSON.stringify({ user }))) } })
    }
    await mount()
    assert.match(container.textContent, /Original Name/)
    await click(button('Edit Profile'))
    assert.equal(container.querySelector('[name="name"]').value, user.name)
    assert.equal(container.querySelector('[name="email"]').value, user.email)
    await input('name', 'Discarded')
    await click(button('Cancel'))
    assert.match(container.textContent, /Original Name/)
    assert.equal(patches, 0)
    await click(button('Edit Profile'))
    assert.equal(container.querySelector('[name="name"]').value, 'Original Name')
    await input('name', '   ')
    await input('email', 'invalid')
    await submit()
    assert.match(container.textContent, /Name is required/)
    assert.match(container.textContent, /valid email/)
    assert.equal(patches, 0)
    await input('name', ' Updated Name ')
    await input('email', ' UPDATED@example.com ')
    await submit()
    assert.equal(patches, 1)
    assert.equal(container.querySelector('form').getAttribute('aria-busy'), 'true')
    for (const control of container.querySelectorAll('form input, form button')) assert.equal(control.disabled, true)
    await submit()
    assert.equal(patches, 1)
    await act(async () => respond())
    assert.match(container.textContent, /Profile updated successfully/)
    assert.deepEqual([...container.querySelectorAll('dd')].map(node => node.textContent), ['Updated Name', 'updated@example.com'])
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), token)
    assert.equal(container.querySelector('[aria-label="Student Workspace"]').textContent, 'U')
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    assert.equal(container.querySelector('.workspace-menu-heading').textContent, 'Updated Name')
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    assert.ok(!container.innerHTML.includes(token))
    assert.equal(container.querySelector('[type="password"]'), null)
    await mount()
    assert.match(container.textContent, /updated@example.com/)
    await click(button('Edit Profile'))
    for (const [status, message] of [[409, /email already exists/], ['network', /Check your connection/], [400, /check your name and email/], [500, /Unable to update your profile/]]) {
      failure = status
      await input('name', 'Not Saved')
      await submit()
      assert.match(container.querySelector('[role="alert"]').textContent, message)
      assert.doesNotMatch(container.textContent, /private diagnostic/)
      assert.equal(button('Save Changes').disabled, false)
    }
    await click(button('Cancel'))
    assert.match(container.textContent, /Updated Name/)
    failure = 401
    await click(button('Edit Profile'))
    await submit()
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)

    // A late successful update must never resurrect a logged-out session.
    failure = null
    window.sessionStorage.setItem(TOKEN_KEY, token)
    await mount()
    await click(button('Edit Profile'))
    await input('name', 'Late Name')
    await submit()
    const late = respond
    await click(button('Sign out'))
    await act(async () => late())
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    assert.doesNotMatch(container.textContent, /Late Name|updated@example.com/)
    return 'PASS: Profile edit/prefill/cancel, validation, PATCH payload, duplicate-submit guard, context and Navbar live updates, restoration, safe errors/401, late update after logout'
  } finally {
    if (root) await act(async () => root.unmount())
    window.sessionStorage.removeItem(TOKEN_KEY)
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    container.remove()
  }
}
