import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { TOKEN_KEY } from '../src/services/authSession'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const originalToken = window.sessionStorage.getItem(TOKEN_KEY)
  const container = document.createElement('div')
  document.body.append(container)
  const base = import.meta.env.BASE_URL
  const photo = '/api/profile-photos/12345678-1234-4123-8123-123456789abc.webp'
  const secondPhoto = '/api/profile-photos/12345678-1234-4123-8123-123456789abd.webp'
  let user = { id: 'photo-a', name: 'Alice', email: 'alice@example.com', emailVerified: false }
  let root, respond, failure, writes = 0
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
  const panel = () => container.querySelector('[aria-labelledby="profile-photo-heading"]')
  const button = text => [...panel().querySelectorAll('button')].find(node => node.textContent === text)
  async function click(text) { await act(async () => button(text).click()) }
  async function select(file) {
    await act(async () => {
      const input = panel().querySelector('input[type="file"]')
      Object.defineProperty(input, 'files', { configurable: true, value: file ? [file] : [] })
      input.dispatchEvent(new window.Event('change', { bubbles: true }))
    })
  }
  async function render(token = 'photo-token-a') {
    if (root) await act(async () => root.unmount())
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token)
    else window.sessionStorage.removeItem(TOKEN_KEY)
    window.history.replaceState({}, '', `${base}profile`)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/applications')) return json([])
      if (url.endsWith('/auth/login-activity')) return json({ activities: [] })
      if (url.endsWith('/auth/me')) return json({ user: options.headers.Authorization === 'Bearer photo-token-b' ? { id: 'photo-b', name: 'Bob', email: 'bob@example.com' } : user })
      assert.ok(url.endsWith('/auth/me/photo'))
      assert.equal(options.headers.Authorization, 'Bearer photo-token-a')
      writes++
      if (failure) return json({ message: 'private diagnostic path' }, failure)
      if (options.method === 'POST') {
        assert.deepEqual([...options.body.keys()], ['photo'])
        assert.equal(options.headers['Content-Type'], undefined)
      }
      return new Promise(resolve => { respond = () => {
        const { profilePhotoUrl: previous, ...rest } = user
        user = { ...rest, ...(options.method === 'POST' ? { profilePhotoUrl: previous ? secondPhoto : photo } : {}) }
        resolve(json({ user }))
      } })
    }
    await render(null)
    assert.equal(panel(), null)
    assert.equal(writes, 0)
    assert.equal(window.location.pathname, `${base}login`)
    await render()
    const storageBefore = [JSON.stringify(window.localStorage), JSON.stringify(window.sessionStorage)]
    assert.equal(container.querySelectorAll('.user-avatar img').length, 0)
    assert.equal(panel().querySelector('.user-avatar').textContent, 'A')
    assert.match(panel().textContent, /JPEG, PNG or WebP. Maximum 2 MB/)
    assert.equal(panel().querySelector('input').accept, 'image/jpeg,image/png,image/webp')
    await click('Upload Photo')
    assert.match(panel().textContent, /Choose a photo first/)
    await select(new File(['svg'], 'bad.svg', { type: 'image/svg+xml' }))
    await click('Upload Photo')
    assert.match(panel().textContent, /Choose a JPEG, PNG or WebP/)
    await select(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
    await click('Upload Photo')
    assert.match(panel().textContent, /at most 2 MB/)
    assert.equal(writes, 0)
    await select(new File(['image bytes'], 'good.png', { type: 'image/png' }))
    await act(async () => { button('Upload Photo').click(); button('Upload Photo').click() })
    assert.equal(writes, 1)
    assert.match(panel().textContent, /Uploading photo/)
    assert.ok(panel().querySelector('input').disabled)
    assert.ok(button('Upload Photo').disabled)
    await act(async () => respond())
    assert.equal(container.querySelectorAll('.user-avatar img').length, 3)
    assert.ok([...container.querySelectorAll('.user-avatar img')].every(image => image.src.endsWith(photo)))
    assert.match(panel().textContent, /Profile photo updated/)
    await act(async () => panel().querySelector('img').dispatchEvent(new window.Event('error')))
    assert.equal(panel().querySelector('.user-avatar').textContent, 'A')
    await select(new File(['replacement'], 'new.webp', { type: 'image/webp' }))
    await click('Change Photo')
    await act(async () => respond())
    assert.ok(panel().querySelector('img').src.endsWith(secondPhoto))
    await render()
    assert.ok(panel().querySelector('img').src.endsWith(secondPhoto))
    failure = 500
    await click('Remove Photo')
    assert.match(panel().textContent, /Unable to update your photo/)
    assert.ok(panel().querySelector('img'))
    assert.doesNotMatch(container.textContent, /private diagnostic path/)
    failure = null
    await click('Remove Photo')
    assert.match(panel().textContent, /Removing photo/)
    await act(async () => respond())
    assert.equal(container.querySelectorAll('.user-avatar img').length, 0)
    assert.equal(panel().querySelector('.user-avatar').textContent, 'A')
    assert.equal(button('Remove Photo'), undefined)
    assert.deepEqual([JSON.stringify(window.localStorage), JSON.stringify(window.sessionStorage)], storageBefore)
    await select(new File(['late'], 'late.png', { type: 'image/png' }))
    await click('Upload Photo')
    await render('photo-token-b')
    await act(async () => respond())
    assert.equal(panel().querySelector('.user-avatar').textContent, 'B')
    assert.equal(container.querySelectorAll('.user-avatar img').length, 0)
    assert.doesNotMatch(container.textContent, /Alice/)
    failure = 401
    await render()
    await select(new File(['expired'], 'expired.png', { type: 'image/png' }))
    await click('Change Photo')
    assert.equal(panel(), null)
    assert.equal(window.location.pathname, `${base}login`)
  } finally {
    if (root) await act(async () => root.unmount())
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    if (originalToken === null) window.sessionStorage.removeItem(TOKEN_KEY)
    else window.sessionStorage.setItem(TOKEN_KEY, originalToken)
    container.remove()
  }
  return 'PASS: protected profile photo upload/replace/remove, immediate Profile/Navbar/Sidebar updates, restoration, initials/broken-image fallback, validation, duplicate/pending/errors, no image storage and account/session isolation'
}
