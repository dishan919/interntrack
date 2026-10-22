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
  let root, release, fail = false, writes = 0, applicationReads = 0
  let application = { id: 'app-a', company: 'IFS', position: 'Intern', status: 'Saved', applicationNotes: [] }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
  const panel = () => container.querySelector('.application-notes-panel')
  const button = text => [...panel().querySelectorAll('button')].find(node => node.textContent === text)
  async function click(text) { await act(async () => button(text).click()) }
  async function input(text) {
    await act(async () => {
      const textarea = panel().querySelector('textarea')
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, text)
      textarea.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  async function submit() { await act(async () => panel().querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
  async function render() {
    if (root) await act(async () => root.unmount())
    window.history.replaceState({}, '', `${base}applications/app-a`)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/notifications')) return Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
      assert.equal(options.headers?.Authorization, 'Bearer notes-user-a')
      if (url.endsWith('/auth/me')) return json({ user: { id: 'user-a', name: 'A', email: 'a@example.com' } })
      if (url.endsWith('/applications')) { applicationReads++; return json([application]) }
      assert.match(url, /\/applications\/app-a\/notes/)
      writes++
      if (fail) return json({ message: 'private database diagnostic' }, 500)
      return new Promise(resolve => {
        release = () => {
          const method = options.method
          const text = options.body ? JSON.parse(options.body).text : undefined
          const now = '2026-10-21T10:00:00.000Z'
          application = { ...application, applicationNotes: method === 'DELETE' ? [] : [{ id: 'note-a', text, createdAt: now, updatedAt: now }] }
          resolve(json(application, method === 'POST' ? 201 : 200))
        }
      })
    }
    window.sessionStorage.removeItem(TOKEN_KEY)
    await render()
    assert.equal(panel(), null)
    assert.equal(applicationReads, 0)
    assert.equal(window.location.pathname, `${base}login`)
    window.sessionStorage.setItem(TOKEN_KEY, 'notes-user-a')
    const storageBefore = [JSON.stringify(window.localStorage), JSON.stringify(window.sessionStorage)]
    await render()
    assert.match(panel().textContent, /Notes.*Private notes/)
    assert.match(panel().textContent, /No notes yet/)
    assert.equal(panel().querySelector('textarea').maxLength, 2000)
    await submit()
    assert.match(panel().textContent, /Note text is required/)
    assert.equal(writes, 0)
    await input('x'.repeat(2001))
    await submit()
    assert.match(panel().textContent, /at most 2000/)
    assert.equal(writes, 0)
    await input('  Private <img src=x onerror=alert(1)>  ')
    await submit()
    assert.match(panel().textContent, /Saving note changes/)
    assert.ok([...panel().querySelectorAll('button')].every(node => node.disabled))
    await submit()
    assert.equal(writes, 1)
    await act(async () => release())
    assert.match(panel().textContent, /Private <img/)
    assert.equal(panel().querySelector('img'), null)
    assert.equal(panel().querySelector('textarea').value, '')
    assert.equal(applicationReads, 1)
    await click('Edit')
    assert.equal(panel().querySelector('textarea').value, 'Private <img src=x onerror=alert(1)>')
    await input('Cancelled edit')
    await click('Cancel')
    assert.match(panel().textContent, /Private <img/)
    await click('Edit')
    await input('Updated private note')
    await submit()
    await act(async () => release())
    assert.match(panel().textContent, /Updated private note/)
    await render()
    assert.match(panel().textContent, /Updated private note/)
    fail = true
    await click('Edit')
    await input('Retain draft')
    await submit()
    assert.match(panel().textContent, /Unable to save your note changes/)
    assert.equal(panel().querySelector('textarea').value, 'Retain draft')
    assert.match(panel().textContent, /Updated private note/)
    assert.doesNotMatch(container.textContent, /private database diagnostic/)
    fail = false
    await click('Cancel')
    await click('Delete')
    await act(async () => release())
    assert.match(panel().textContent, /No notes yet/)
    assert.deepEqual([JSON.stringify(window.localStorage), JSON.stringify(window.sessionStorage)], storageBefore)

    // A late response after logout must not restore private application state.
    await input('Late private response')
    await submit()
    window.sessionStorage.removeItem(TOKEN_KEY)
    await render()
    assert.equal(panel(), null)
    await act(async () => release())
    assert.equal(panel(), null)
    assert.doesNotMatch(container.textContent, /Late private response/)
  } finally {
    if (root) await act(async () => root.unmount())
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    if (originalToken === null) window.sessionStorage.removeItem(TOKEN_KEY)
    else window.sessionStorage.setItem(TOKEN_KEY, originalToken)
    container.remove()
  }
  return 'PASS: private Notes details section, empty/add/edit/delete/cancel, validation, safe plain text, pending/duplicate/error handling, API state persistence, no note storage and logout isolation'
}
