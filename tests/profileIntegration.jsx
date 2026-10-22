import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import Profile from '../src/pages/Profile'
import { AuthContext } from '../src/context/AuthContext'
import { TOKEN_KEY, getAccessToken } from '../src/services/authSession'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const originalToken = window.sessionStorage.getItem(TOKEN_KEY)
  const container = document.createElement('div')
  document.body.append(container)
  const base = import.meta.env.BASE_URL
  const user = { id: 'profile-user', name: 'Profile Example', email: 'profile@example.com', password: 'private-password-marker' }
  const token = 'private-profile-token-marker'
  const calls = []
  let root
  async function unmount() { if (root) { await act(async () => root.unmount()); root = null } }
  async function visit(path) {
    await unmount()
    window.history.replaceState({}, '', `${base}${path}`)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  }
  async function click(element) {
    assert.ok(element)
    await act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
  }
  function assertProfile() {
    assert.equal(container.querySelector('h1').textContent, 'Profile')
    assert.deepEqual([...container.querySelectorAll('dt')].map(node => node.textContent), ['Full name', 'Email address'])
    assert.deepEqual([...container.querySelectorAll('dd')].map(node => node.textContent), [user.name, user.email])
    assert.doesNotMatch(container.innerHTML, /private-password-marker|private-profile-token-marker/)
    assert.equal(container.querySelector('input:not([type="file"])'), null)
    assert.equal(container.querySelectorAll('input[type="file"]').length, 1)
    assert.equal(container.querySelector('input[type="file"]').accept, 'image/jpeg,image/png,image/webp')
    assert.match(container.textContent, /change your password in Security/)
  }
  try {
    // Account details consume context; only the separate activity panel fetches history.
    globalThis.fetch = async url => {
      assert.ok(url.endsWith('/auth/login-activity'), 'Profile must not refetch account details')
      return new Response('{"activities":[]}')
    }
    let loggedOut = 0
    root = createRoot(container)
    await act(async () => root.render(<AuthContext.Provider value={{ user, accessToken: token, logout: () => loggedOut++ }}><Profile /></AuthContext.Provider>))
    assertProfile()
    await click([...container.querySelectorAll('button')].find(button => button.textContent === 'Sign out'))
    assert.equal(loggedOut, 1, 'Profile uses the existing context logout action')
    await unmount()

    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/notifications')) return Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
      calls.push({ url, options })
      if (url.endsWith('/auth/login-activity')) return new Response('{"activities":[]}')
      if (url.endsWith('/auth/me')) {
        assert.equal(options.headers.Authorization, `Bearer ${token}`)
        return new Response(JSON.stringify({ user }))
      }
      assert.ok(url.endsWith('/applications'))
      return new Response('[]')
    }
    window.sessionStorage.removeItem(TOKEN_KEY)
    await visit('profile')
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(calls.length, 0)

    window.sessionStorage.setItem(TOKEN_KEY, token)
    await visit('')
    const meCount = () => calls.filter(call => call.url.endsWith('/auth/me')).length
    assert.equal(meCount(), 1)
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    const profileLink = container.querySelector(`.workspace-menu a[href="${base}profile"]`)
    assert.equal(document.activeElement, profileLink, 'Account menu focuses its first link')
    await click(profileLink)
    assert.equal(window.location.pathname, `${base}profile`)
    assertProfile()
    assert.equal(meCount(), 1, 'Navigation to Profile adds no /me request')

    await visit('profile')
    assertProfile()
    assert.equal(meCount(), 2, 'Refresh verifies once through AuthProvider')
    await click([...container.querySelectorAll('button')].find(button => button.textContent === 'Sign out'))
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    assert.equal(getAccessToken(), null)
    assert.doesNotMatch(container.textContent, /Profile Example|profile@example.com/)
    await visit('profile')
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(meCount(), 2)

    // The existing account-menu logout works while viewing Profile too.
    window.sessionStorage.setItem(TOKEN_KEY, token)
    await visit('profile')
    await click(container.querySelector('[aria-label="Student Workspace"]'))
    await click(container.querySelector('.workspace-menu button:last-child'))
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    return 'PASS: Profile context name/email, no password/token, protected basename route, account-menu navigation/focus, no duplicate /me, refresh, profile and workspace logout'
  } finally {
    await unmount()
    container.remove()
    globalThis.fetch = originalFetch
    if (originalToken === null) window.sessionStorage.removeItem(TOKEN_KEY)
    else window.sessionStorage.setItem(TOKEN_KEY, originalToken)
    window.history.replaceState({}, '', originalUrl)
  }
}
