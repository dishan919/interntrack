import assert from 'node:assert/strict'
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { TOKEN_KEY } from '../src/services/authSession'
import { VERIFIED_MESSAGE, RESENT_MESSAGE, INVALID_VERIFICATION_MESSAGE } from '../src/services/authService'

export default async function verify() {
  const originalFetch = globalThis.fetch
  const originalUrl = window.location.href
  const container = document.createElement('div')
  document.body.append(container)
  const base = import.meta.env.BASE_URL
  const token = 'c'.repeat(64)
  let root, respondVerify, respondResend, verificationStatus = 200, resendStatus = 200
  let verificationCalls = 0, resendCalls = 0, meCalls = 0
  let user = { id: 'verify-user', name: 'Verify User', email: 'verify@example.com', emailVerified: false }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
  const button = text => [...container.querySelectorAll('button')].find(node => node.textContent === text)
  async function click(element) { assert.ok(element); await act(async () => element.click()) }
  async function render(path, strict = false) {
    if (root) await act(async () => root.unmount())
    window.history.replaceState({}, '', base + path)
    root = createRoot(container)
    await act(async () => root.render(strict ? <StrictMode><App /></StrictMode> : <App />))
  }
  async function input(name, value) {
    await act(async () => {
      const element = container.querySelector(`[name="${name}"]`)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
  }
  try {
    window.sessionStorage.clear()
    const localBefore = JSON.stringify(window.localStorage)
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/auth/me')) {
        assert.equal(options.headers.Authorization, 'Bearer verification-session')
        if (options.method === 'PATCH') {
          const body = JSON.parse(options.body)
          user = { ...user, ...body, emailVerified: body.email !== user.email ? false : user.emailVerified }
        } else meCalls++
        return json({ user })
      }
      if (url.endsWith('/applications')) return json([])
      if (url.endsWith('/verify-email')) {
        verificationCalls++
        assert.deepEqual(JSON.parse(options.body), { token })
        assert.equal(options.headers.Authorization, undefined)
        return new Promise(resolve => { respondVerify = () => {
          if (verificationStatus === 200) user = { ...user, emailVerified: true }
          resolve(json({ message: verificationStatus === 200 ? VERIFIED_MESSAGE : 'private diagnostics' }, verificationStatus))
        } })
      }
      assert.ok(url.endsWith('/resend-verification'))
      resendCalls++
      assert.equal(options.headers.Authorization, 'Bearer verification-session')
      assert.deepEqual(JSON.parse(options.body), {})
      return new Promise(resolve => { respondResend = () => resolve(json({ message: resendStatus === 200 ? RESENT_MESSAGE : 'private diagnostic' }, resendStatus)) })
    }
    await render('verify-email')
    assert.match(container.textContent, /verification token is required/)
    assert.equal(verificationCalls, 0)
    await render('verify-email?token=malformed')
    assert.match(container.textContent, /invalid or has expired/)
    assert.equal(verificationCalls, 0)
    await render(`verify-email?token=${token}`, true)
    assert.match(container.textContent, /Verifying your email/)
    assert.equal(verificationCalls, 1, 'StrictMode must not consume a token twice')
    await act(async () => respondVerify())
    assert.match(container.textContent, /Email verified successfully/)
    assert.equal(window.location.search, '')
    assert.equal(window.sessionStorage.length, 0)
    assert.ok(container.querySelector(`a[href="${base}login"]`))
    assert.ok(!container.innerHTML.includes(token))
    verificationStatus = 400
    await render(`verify-email?token=${token}`)
    await act(async () => respondVerify())
    assert.match(container.textContent, new RegExp(INVALID_VERIFICATION_MESSAGE))
    assert.doesNotMatch(container.textContent, /private diagnostic/)
    user.emailVerified = false
    window.sessionStorage.setItem(TOKEN_KEY, 'verification-session')
    await render('profile')
    assert.match(container.textContent, /Not verified/)
    assert.ok(button('Resend Verification'))
    const sessionBefore = JSON.stringify(window.sessionStorage)
    const resendButton = button('Resend Verification')
    await click(resendButton)
    assert.equal(resendButton.disabled, true)
    assert.match(container.textContent, /Requesting verification/)
    await click(resendButton)
    assert.equal(resendCalls, 1)
    await act(async () => respondResend())
    assert.match(container.textContent, new RegExp(RESENT_MESSAGE))
    resendStatus = 500
    await click(button('Resend Verification'))
    await act(async () => respondResend())
    assert.match(container.textContent, /Unable to process verification/)
    assert.doesNotMatch(container.textContent, /private diagnostic/)
    verificationStatus = 200
    const beforeMe = meCalls
    await render(`verify-email?token=${token}`, true)
    await act(async () => respondVerify())
    assert.match(container.textContent, /Email verified successfully/)
    assert.ok(meCalls > beforeMe, 'Verification refetches safe user status')
    await click(container.querySelector(`a[href="${base}profile"]`))
    assert.match(container.textContent, /Status: Verified/)
    assert.equal(button('Resend Verification'), undefined)
    assert.match(container.textContent, /Verify User/)
    await render('profile')
    assert.match(container.textContent, /Status: Verified/, 'Session restoration retains verified state')
    await click(button('Edit Profile'))
    await input('email', 'changed@example.com')
    await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(container.textContent, /changed@example.com/)
    assert.match(container.textContent, /Not verified/)
    assert.ok(button('Resend Verification'))
    assert.equal(JSON.stringify(window.sessionStorage), sessionBefore)
    assert.equal(JSON.stringify(window.localStorage), localBefore)
    resendStatus = 401
    await click(button('Resend Verification'))
    await act(async () => respondResend())
    assert.equal(window.location.pathname, `${base}login`)
    assert.equal(window.sessionStorage.getItem(TOKEN_KEY), null)
    return 'PASS: verification public basename route, missing/invalid/verifying/success states, StrictMode deduplication, token privacy, profile status/resend loading/errors/401, safe current-user refresh/restoration and email-change invalidation'
  } finally {
    if (root) await act(async () => root.unmount())
    window.sessionStorage.clear()
    globalThis.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
    container.remove()
  }
}
