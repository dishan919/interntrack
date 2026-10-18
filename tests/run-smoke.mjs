// Real React UI -> service -> Express -> disposable MongoDB. No personal database.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import User from '../server/src/models/User.js'
import { createAccessToken } from '../server/src/config/jwt.js'
import app from '../server/src/app.js'
import { connectDatabase, disconnectDatabase } from '../server/src/config/database.js'
import { startTestDatabase } from '../server/tests/helpers/database.js'

const originalFetch = globalThis.fetch
const originalSecret = process.env.JWT_SECRET
process.env.JWT_SECRET = "feature04-ui-smoke-test-secret"
const database = await startTestDatabase()
let backend, vite, root
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/applications/new' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.confirm = () => true
try {
  await connectDatabase(database.getUri())
  backend = app.listen(0, '127.0.0.1')
  await once(backend, 'listening')
  process.env.VITE_API_URL = `http://127.0.0.1:${backend.address().port}/api`
  const user = await User.create({ name: 'Smoke User', email: 'smoke@example.com', password: 'TestPassword123' })
  const token = createAccessToken(user.id, process.env.JWT_SECRET)
  // Test-only transport supplies credentials without adding frontend token storage/UI.
  globalThis.fetch = (url, options) => originalFetch(url, { ...options, headers: { ...options?.headers, Authorization: `Bearer ${token}` } })
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const container = document.getElementById('root')
  async function waitFor(predicate) {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (predicate()) return
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    }
    throw new Error('UI smoke timed out: ' + container.textContent.slice(0, 500))
  }
  async function refresh() {
    if (root) await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(createElement(App)))
    await waitFor(() => !container.textContent.includes('Loading applications'))
  }
  async function input(name, value) {
    const element = container.querySelector(`[name="${name}"]`)
    assert.ok(element, name)
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  async function click(element) { assert.ok(element); await act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 }))) }
  const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.includes(text))
  const read = async () => (await fetch(process.env.VITE_API_URL + '/applications')).json()

  await refresh()
  await input('company', 'Step 4 Smoke')
  await input('position', 'React Intern')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === '/applications' && container.textContent.includes('Step 4 Smoke'))
  let records = await read()
  assert.equal(records.length, 1)
  const id = records[0].id
  await refresh()
  assert.match(container.textContent, /Step 4 Smoke/)
  await click(container.querySelector(`a[href="/applications/${id}"]`))
  await click(container.querySelector(`a[href="/applications/${id}/edit"]`))
  await input('company', 'Step 4 Updated')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === '/applications/' + id)
  await refresh()
  assert.match(container.textContent, /Step 4 Updated/)
  await click(container.querySelector('a[href="/applications"]'))
  await click(button('Board View'))
  const select = container.querySelector('.kanban-card select')
  await act(async () => {
    select.value = 'Offer'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await waitFor(() => !container.textContent.includes('Saving changes'))
  await refresh()
  assert.equal(container.querySelector('.kanban-card select').value, 'Offer')
  records = await read()
  assert.equal(records[0].status, 'Offer')
  assert.equal(records[0].activity.at(-1).type, 'status_changed')
  await click(container.querySelector(`a[href="/applications/${id}"]`))
  await click(button('Delete application'))
  await waitFor(() => window.location.pathname === '/applications')
  await refresh()
  assert.equal((await read()).length, 0)
  assert.doesNotMatch(container.textContent, /Step 4 Updated/)
  console.log('PASS: real React DOM create/refresh/edit/refresh/Kanban/refresh/delete/refresh through Express and disposable MongoDB')
  await act(async () => root.unmount())
  root = null
} finally {
  globalThis.fetch = originalFetch
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
  if (vite) await vite.close()
  if (backend) await new Promise(resolve => backend.close(resolve))
  await disconnectDatabase()
  await database.stop()
  dom.window.close()
}
