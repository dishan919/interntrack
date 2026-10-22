import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { TOKEN_KEY } from '../src/services/authSession'
const VIEW_KEY = 'interntrack_application_view'

export default async function verify() {
  const originalFetch = globalThis.fetch, originalUrl = window.location.href
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = window.localStorage
  const originalToken = window.sessionStorage.getItem(TOKEN_KEY)
  const originalView = window.localStorage.getItem(VIEW_KEY)
  const container = document.createElement('div'); document.body.append(container)
  const base = import.meta.env.BASE_URL
  const data = [{ id: '0123456789abcdef01234567', company: 'A Company', position: 'Intern', status: 'Interview', createdAt: '2026-10-20', followUp: { date: '2028-01-01' } }, { id: '0123456789abcdef01234568', company: 'B Company', position: 'Engineer', status: 'Offer', createdAt: '2026-10-19', followUp: { date: '2028-01-01', completed: true } }]
  let root
  const json = value => new Response(JSON.stringify(value))
  async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))) }
  async function key(name, shiftKey = false) { await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }))) }
  try {
    globalThis.fetch = async url => {
      if (url.endsWith('/auth/me')) return json({ user: { id: 'design-user', name: 'Alex Morgan', email: 'alex@example.com', profilePhotoUrl: '/api/profile-photos/12345678-1234-4123-8123-123456789abc.webp' } })
      if (url.endsWith('/applications')) return json(data)
      if (url.endsWith('/notifications')) return json({ notifications: [], unreadCount: 4 })
      throw new Error('Unexpected request: ' + url)
    }
    window.sessionStorage.setItem(TOKEN_KEY, 'design-token')
    window.localStorage.removeItem(VIEW_KEY)
    const themeBefore = window.localStorage.getItem('theme')
    window.history.replaceState({}, '', base)
    root = createRoot(container); await act(async () => root.render(<App />))
    assert.equal(container.querySelector('h1').textContent, 'Welcome back, Alex.')
    const stats = [...container.querySelectorAll('.stat-card')]
    assert.equal(stats.find(node => node.textContent.includes('Total applications')).querySelector('.stat-value').textContent, '2')
    assert.equal(stats.find(node => node.textContent.includes('Pending follow-ups')).querySelector('.stat-value').textContent, '1')
    assert.deepEqual([...container.querySelectorAll('nav[aria-label="Main navigation"] a')].map(node => node.textContent), ['Overview', 'Applications', 'Kanban', 'Companies', 'Statistics', 'Settings'])
    assert.equal(container.querySelector('.notification-count').textContent, '4')
    assert.equal(container.querySelectorAll('.user-avatar img').length, 2)
    await act(async () => container.querySelector('.sidebar img').dispatchEvent(new window.Event('error')))
    assert.equal(container.querySelector('.sidebar .user-avatar').textContent, 'A')
    const toggle = container.querySelector('[aria-label="Toggle navigation"]')
    assert.equal(toggle.getAttribute('aria-controls'), 'workspace-navigation')
    const previousOverflow = document.body.style.overflow
    await click(toggle)
    assert.equal(toggle.getAttribute('aria-expanded'), 'true')
    assert.ok(container.querySelector('.sidebar.open'))
    assert.equal(document.body.style.overflow, 'hidden')
    const first = container.querySelector('.sidebar a')
    assert.equal(document.activeElement, first)
    const last = container.querySelector('.sidebar-logout')
    await act(async () => last.focus()); await key('Tab')
    assert.equal(document.activeElement, first)
    await key('Tab', true)
    assert.equal(document.activeElement, last)
    await key('Escape')
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(document.activeElement, toggle)
    assert.equal(document.body.style.overflow, previousOverflow)
    await click(toggle)
    await click(container.querySelector('nav a[href="' + base + 'applications?view=board"]'))
    assert.ok(container.querySelector('.kanban-board'))
    assert.equal(container.querySelectorAll('nav a[aria-current="page"]').length, 1)
    assert.equal(container.querySelectorAll('nav a.active').length, 1)
    assert.equal(container.querySelector('nav a[aria-current="page"]').textContent, 'Kanban')
    assert.equal(container.querySelector('.sidebar.open'), null)
    const list = [...container.querySelectorAll('.view-switcher button')].find(node => node.textContent === 'List View')
    await click(list)
    assert.equal(container.querySelector('.kanban-board'), null)
    assert.equal(container.querySelectorAll('.application-row').length, 2)
    assert.equal(container.querySelectorAll('nav a[aria-current="page"]').length, 1)
    assert.equal(container.querySelectorAll('nav a.active').length, 1)
    assert.equal(container.querySelector('nav a[aria-current="page"]').textContent, 'Applications')
    assert.equal(window.localStorage.getItem(VIEW_KEY), 'list')
    assert.equal(window.localStorage.getItem('theme'), themeBefore)
    assert.equal(container.querySelector('.skip-link').getAttribute('href'), '#main-content')
    assert.ok(container.querySelector('main#main-content'))
  } finally {
    if (root) await act(async () => root.unmount())
    globalThis.localStorage = originalStorage
    globalThis.fetch = originalFetch; window.history.replaceState({}, '', originalUrl)
    if (originalToken === null) window.sessionStorage.removeItem(TOKEN_KEY); else window.sessionStorage.setItem(TOKEN_KEY, originalToken)
    if (originalView === null) window.localStorage.removeItem(VIEW_KEY); else window.localStorage.setItem(VIEW_KEY, originalView)
    container.remove()
  }
  return 'PASS: redesigned shell navigation, Kanban deep link/list persistence, real dashboard metrics, user avatar/fallback, unread badge, sidebar focus loop/Escape/scroll restoration, skip link and untouched theme preference'
}
