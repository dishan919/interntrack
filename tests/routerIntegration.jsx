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
  let root
  async function visit(path) {
    if (root) await act(async () => root.unmount())
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
      ['', 'Track your applications.'], ['register', 'Create your account'],
      ['applications', 'Applications'], ['applications/new', 'Add application'],
      ['applications/route-test', 'Routing Intern'], ['applications/route-test/edit', 'Edit application'],
      ['companies', 'Companies'], ['statistics', 'Statistics'], ['settings', 'Settings'],
    ]) {
      await visit(path)
      assert.ok(container.querySelector('h1')?.textContent.includes(heading), `Route ${base}${path} should show ${heading}`)
      assert.doesNotMatch(container.textContent, /Page not found/)
    }
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
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
    window.history.replaceState({}, '', originalUrl)
  }
}
