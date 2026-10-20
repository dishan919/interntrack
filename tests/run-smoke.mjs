// Real React UI -> service -> Express -> disposable MongoDB. No personal database.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { JSDOM } from 'jsdom'
import { createServer, resolveConfig } from 'vite'
import User from '../server/src/models/User.js'
import LoginActivity from '../server/src/models/LoginActivity.js'
import app from '../server/src/app.js'
import { setTestVerificationCapture } from '../server/src/services/emailVerification.js'
import { setTestResetCapture } from '../server/src/services/passwordResetDelivery.js'
import { connectDatabase, disconnectDatabase } from '../server/src/config/database.js'
import { startTestDatabase } from '../server/tests/helpers/database.js'

const originalFetch = globalThis.fetch
const originalNodeEnv = process.env.NODE_ENV
process.env.NODE_ENV = 'test'
let verificationDelivery
setTestVerificationCapture(details => { verificationDelivery = details })
let resetDelivery
setTestResetCapture(details => { resetDelivery = details })
const originalSecret = process.env.JWT_SECRET
process.env.JWT_SECRET = "feature04-ui-smoke-test-secret"
const { base } = await resolveConfig({}, 'serve')
const database = await startTestDatabase()
let backend, vite, root
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: `http://localhost${base}applications/new` })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.confirm = () => true
try {
  console.log('Smoke: connecting disposable database')
  await connectDatabase(database.getUri())
  backend = app.listen(0, '127.0.0.1')
  await once(backend, 'listening')
  process.env.VITE_API_URL = `http://127.0.0.1:${backend.address().port}/api`
  const user = await User.create({ name: 'Smoke User', email: 'smoke@example.com', password: 'TestPassword123' })
  assert.ok(user.id)
  console.log('Smoke: obtaining test session')
  const login = await originalFetch(`${process.env.VITE_API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'smoke@example.com', password: 'TestPassword123' }) })
  assert.equal(login.status, 200)
  const { accessToken } = await login.json()
  window.sessionStorage.setItem('interntrack_access_token', accessToken)
  // Assert production transport supplies Bearer headers; never inject them here.
  globalThis.fetch = (url, options) => {
    if (url.includes('/applications')) assert.equal(options?.headers?.Authorization, `Bearer ${window.sessionStorage.getItem('interntrack_access_token')}`)
    // Simulate a browser's self-reported agent in this Node-based UI renderer.
    if (url.endsWith('/auth/login')) return originalFetch(url, { ...options, headers: { ...options?.headers, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36' } })
    return originalFetch(url, options)
  }
  console.log('Smoke: starting test renderer')
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
    await waitFor(() => !container.textContent.includes('Loading applications') && !container.textContent.includes('Checking your session')
      && container.querySelector('[aria-labelledby="login-activity-heading"]')?.getAttribute('aria-busy') !== 'true')
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
  const read = async () => (await originalFetch(process.env.VITE_API_URL + '/applications', { headers: { Authorization: `Bearer ${accessToken}` } })).json()

  console.log('Smoke: restoring session and rendering application form')
  await refresh()
  await input('company', 'Step 4 Smoke')
  await input('position', 'React Intern')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === `${base}applications` && container.textContent.includes('Step 4 Smoke'))
  let records = await read()
  assert.equal(records.length, 1)
  const id = records[0].id
  await refresh()
  assert.match(container.textContent, /Step 4 Smoke/)
  await click(container.querySelector(`a[href="${base}applications/${id}"]`))
  await click(container.querySelector(`a[href="${base}applications/${id}/edit"]`))
  await input('company', 'Step 4 Updated')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === `${base}applications/${id}`)
  await refresh()
  assert.match(container.textContent, /Step 4 Updated/)
  await click(container.querySelector(`a[href="${base}applications"]`))
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
  await click(container.querySelector(`a[href="${base}applications/${id}"]`))
  await click(button('Delete application'))
  await waitFor(() => window.location.pathname === `${base}applications`)
  await refresh()
  assert.equal((await read()).length, 0)
  assert.doesNotMatch(container.textContent, /Step 4 Updated/)
  await click(container.querySelector('[aria-label="Student Workspace"]'))
  await click(button('Sign out'))
  await waitFor(() => window.location.pathname === `${base}login`)
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), null)
  // Exercise the real login form and provider, in addition to restoration above.
  await input('email', 'smoke@example.com')
  await input('password', 'TestPassword123')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === base && container.textContent.includes('Track your applications'))
  assert.ok(window.sessionStorage.getItem('interntrack_access_token'))
  assert.doesNotMatch(container.textContent, /TestPassword123/)
  await click(container.querySelector('[aria-label="Student Workspace"]'))
  await click(container.querySelector(`a[href="${base}profile"]`))
  assert.equal(window.location.pathname, `${base}profile`)
  assert.match(container.textContent, /Smoke User/)
  assert.match(container.textContent, /smoke@example.com/)
  const profileToken = window.sessionStorage.getItem('interntrack_access_token')
  const activityPanel = () => container.querySelector('[aria-labelledby="login-activity-heading"]')
  await waitFor(() => activityPanel()?.querySelectorAll('li').length >= 2)
  assert.match(activityPanel().textContent, /Chrome on Windows/)
  assert.match(activityPanel().textContent, /IP address: 127.0.0.1/)
  const loginHistory = async sessionToken => {
    const result = await originalFetch(process.env.VITE_API_URL + '/auth/login-activity', { headers: { Authorization: `Bearer ${sessionToken}` } })
    assert.equal(result.status, 200)
    return (await result.json()).activities
  }
  const beforeFailedLogin = await loginHistory(profileToken)
  assert.equal((await originalFetch(process.env.VITE_API_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'smoke@example.com', password: 'WrongPassword123' }) })).status, 401)
  assert.equal((await loginHistory(profileToken)).length, beforeFailedLogin.length)
  await click([...activityPanel().querySelectorAll('button')].find(element => element.textContent === 'Refresh'))
  await waitFor(() => activityPanel()?.getAttribute('aria-busy') === 'false')
  assert.equal(activityPanel().querySelectorAll('li').length, beforeFailedLogin.length)
  assert.ok(beforeFailedLogin.every((entry, index, all) => index === 0 || Date.parse(all[index - 1].loggedInAt) >= Date.parse(entry.loggedInAt)))
  for (const entry of beforeFailedLogin) assert.deepEqual(Object.keys(entry).sort(), ['id', 'ipAddress', 'loggedInAt', 'userAgent'])

  assert.match(container.textContent, /Not verified/)
  await click(button('Resend Verification'))
  await waitFor(() => container.textContent.includes('Verification instructions have been requested.') && button('Resend Verification') && !button('Resend Verification').disabled)
  assert.ok(verificationDelivery?.token)
  window.history.replaceState({}, '', `${base}verify-email?token=${verificationDelivery.token}`)
  await refresh()
  await waitFor(() => container.textContent.includes('Email verified successfully.'))
  assert.equal(window.location.search, '')
  await click(container.querySelector(`a[href="${base}profile"]`))
  await waitFor(() => container.textContent.includes('Status: Verified'))
  assert.equal(button('Resend Verification'), undefined)

  await click(button('Edit Profile'))
  await input('name', 'Updated Smoke User')
  await input('email', 'updated.smoke@example.com')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => container.textContent.includes('Profile updated successfully.'))
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), profileToken)
  assert.equal(container.querySelector('[aria-label="Student Workspace"]').textContent, 'U')
  assert.match(container.textContent, /Not verified/)
  assert.ok(button('Resend Verification'))
  assert.equal(verificationDelivery.email, 'updated.smoke@example.com')

  await refresh()
  assert.equal(container.querySelector('h1').textContent, 'Profile')
  assert.match(container.textContent, /updated.smoke@example.com/)
  assert.doesNotMatch(container.innerHTML, /TestPassword123/)
  assert.ok(!container.innerHTML.includes(window.sessionStorage.getItem('interntrack_access_token')))
  await click(button('Change Password'))
  await input('currentPassword', 'TestPassword123')
  await input('newPassword', 'ChangedSmokePassword456')
  await input('confirmNewPassword', 'ChangedSmokePassword456')
  await act(async () => container.querySelector('form[aria-label="Change password"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => container.textContent.includes('Password changed successfully.'))
  for (const name of ['currentPassword', 'newPassword', 'confirmNewPassword']) {
    assert.equal(container.querySelector(`[name="${name}"]`).value, '')
    assert.equal(container.querySelector(`[name="${name}"]`).type, 'password')
  }
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), profileToken)
  assert.equal((await originalFetch(process.env.VITE_API_URL + '/auth/me', { headers: { Authorization: `Bearer ${profileToken}` } })).status, 200)
  const oldLogin = await originalFetch(process.env.VITE_API_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'updated.smoke@example.com', password: 'TestPassword123' }) })
  assert.equal(oldLogin.status, 401)
  await click(button('Sign out'))
  await waitFor(() => window.location.pathname === `${base}login`)
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), null)
  await input('email', 'updated.smoke@example.com')
  await input('password', 'ChangedSmokePassword456')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === base && container.textContent.includes('Track your applications'))
  console.log('PASS: real API Profile edit, live account update, refresh, shared logout and login with updated email')
  console.log('PASS: real API password change, cleared fields, same JWT validity, old-password rejection and new-password login')
  window.sessionStorage.setItem('interntrack_access_token', 'invalid-test-token')
  await refresh()
  await waitFor(() => window.location.pathname === `${base}login`)
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), null)
  await click(container.querySelector(`a[href="${base}forgot-password"]`))
  await input('email', 'updated.smoke@example.com')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => container.textContent.includes('If an account exists'))
  assert.ok(resetDelivery?.token)
  window.history.replaceState({}, '', `${base}reset-password?token=${resetDelivery.token}`)
  await refresh()
  await input('newPassword', 'ResetSmokePassword789')
  await input('confirmNewPassword', 'ResetSmokePassword789')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => container.textContent.includes('Password reset successfully'))
  assert.equal(window.location.search, '')
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), null)
  await click(container.querySelector(`a[href="${base}login"]`))
  await input('email', 'updated.smoke@example.com')
  await input('password', 'ResetSmokePassword789')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === base && container.textContent.includes('Track your applications'))
  console.log('PASS: real API forgot/reset UI, test-only delivery, removed query token, explicit new-password login')
  await click(container.querySelector('[aria-label="Student Workspace"]'))
  await click(container.querySelector(`a[href="${base}profile"]`))
  assert.match(container.textContent, /Not verified/)
  await click(button('Resend Verification'))
  await waitFor(() => container.textContent.includes('Verification instructions have been requested.') && button('Resend Verification') && !button('Resend Verification').disabled)
  const firstVerification = verificationDelivery.token
  await click(button('Resend Verification'))
  await waitFor(() => !container.textContent.includes('Requesting verification...'))
  assert.notEqual(firstVerification, verificationDelivery.token)
  const rejected = await originalFetch(process.env.VITE_API_URL + '/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: firstVerification }) })
  assert.equal(rejected.status, 400)
  const verificationSession = window.sessionStorage.getItem('interntrack_access_token')
  window.history.replaceState({}, '', `${base}verify-email?token=${verificationDelivery.token}`)
  await refresh()
  await waitFor(() => container.textContent.includes('Email verified successfully.'))
  await click(container.querySelector(`a[href="${base}profile"]`))
  await waitFor(() => container.textContent.includes('Status: Verified'))
  await refresh()
  assert.match(container.textContent, /Status: Verified/)
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), verificationSession)
  assert.equal(button('Resend Verification'), undefined)
  assert.ok(!JSON.stringify(window.sessionStorage).includes(verificationDelivery.token))
  console.log('PASS: real API verification/resend, one-time replacement, live AuthContext refresh/restoration and verified email-change invalidation')
  // Seed two owned applications and an isolated second account through the real API.
  const otherCredentials = { name: 'Retained Smoke User', email: 'retained.smoke@example.com', password: 'OtherSmokePassword123' }
  const otherRegistration = await originalFetch(process.env.VITE_API_URL + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(otherCredentials) })
  assert.equal(otherRegistration.status, 201)
  const otherUser = (await otherRegistration.json()).user
  const otherLoginResponse = await originalFetch(process.env.VITE_API_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(otherCredentials) })
  const otherLogin = await otherLoginResponse.json()
  const otherHistory = await loginHistory(otherLogin.accessToken)
  assert.equal(otherHistory.length, 1)
  assert.ok(otherHistory.every(item => !(beforeFailedLogin.some(own => own.id === item.id))))

  const createOwned = (sessionToken, company) => originalFetch(process.env.VITE_API_URL + '/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ company, position: 'Intern' }) })
  assert.equal((await createOwned(verificationSession, 'Deleted Smoke A1')).status, 201)
  assert.equal((await createOwned(verificationSession, 'Deleted Smoke A2')).status, 201)
  assert.equal((await createOwned(otherLogin.accessToken, 'Retained Smoke B1')).status, 201)
  await refresh()
  await click(container.querySelector(`a[href="${base}applications"]`))
  assert.match(container.textContent, /Deleted Smoke A1/)
  assert.match(container.textContent, /Deleted Smoke A2/)
  await click(container.querySelector('[aria-label="Student Workspace"]'))
  await click(container.querySelector(`a[href="${base}profile"]`))
  assert.match(container.textContent, /Danger Zone/)
  await click(button('Delete Account'))
  assert.equal(container.querySelector('input[id="delete-current-password"]').type, 'password')
  await input('currentPassword', 'WrongPassword123')
  await act(async () => container.querySelector('form[aria-label="Delete account"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => container.textContent.includes('Current password is incorrect.'))
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), verificationSession)
  assert.equal((await read()).length, 2)
  await input('currentPassword', 'ResetSmokePassword789')
  await act(async () => container.querySelector('form[aria-label="Delete account"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === `${base}login`)
  assert.equal(window.sessionStorage.getItem('interntrack_access_token'), null)
  assert.doesNotMatch(container.textContent, /Updated Smoke User|Deleted Smoke A1|Deleted Smoke A2/)
  assert.equal(await User.findById(user.id), null)
  assert.ok(await User.findById(otherUser.id))
  assert.equal(await LoginActivity.countDocuments({ user: user.id }), 0)
  assert.equal(await LoginActivity.countDocuments({ user: otherUser.id }), 1)
  assert.deepEqual(await loginHistory(otherLogin.accessToken), otherHistory)
  assert.equal((await originalFetch(process.env.VITE_API_URL + '/auth/login-activity', { headers: { Authorization: `Bearer ${verificationSession}` } })).status, 401)

  assert.equal((await originalFetch(process.env.VITE_API_URL + '/auth/me', { headers: { Authorization: `Bearer ${verificationSession}` } })).status, 401)
  assert.equal((await createOwned(verificationSession, 'Must Not Be Created')).status, 401)
  const deletedLogin = await originalFetch(process.env.VITE_API_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'updated.smoke@example.com', password: 'ResetSmokePassword789' }) })
  assert.equal(deletedLogin.status, 401)
  await input('email', otherCredentials.email)
  await input('password', otherCredentials.password)
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => window.location.pathname === base && container.textContent.includes('Retained Smoke B1'))
  assert.doesNotMatch(container.textContent, /Deleted Smoke A1|Deleted Smoke A2/)
  console.log('PASS: real API delete confirmation/reauthentication, A1/A2 cleanup, session/private-state removal, old JWT rejection and retained B/B1 login')
  await click(container.querySelector('[aria-label="Student Workspace"]'))
  await click(container.querySelector(`a[href="${base}profile"]`))
  await waitFor(() => activityPanel()?.querySelectorAll('li').length === 2)
  assert.match(activityPanel().textContent, /Chrome on Windows/)
  assert.ok(!JSON.stringify(window.sessionStorage).includes('ipAddress'))
  assert.ok(!JSON.stringify(window.localStorage).includes('loggedInAt'))
  await click(button('Sign out'))
  await waitFor(() => window.location.pathname === `${base}login`)
  assert.equal(activityPanel(), null)
  console.log('PASS: real API login history recording/order/refresh, no failed-login record, A/B isolation, deletion cleanup, old JWT rejection and private UI removal')



  console.log('PASS: real API session restoration, UI logout/login to dashboard, and invalid-token cleanup')
  console.log('PASS: real React DOM create/refresh/edit/refresh/Kanban/refresh/delete/refresh through Express and disposable MongoDB')
  await act(async () => root.unmount())
  root = null
} finally {
  console.log('Smoke: cleaning up')
  setTestVerificationCapture(undefined)
  setTestResetCapture(undefined)
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  globalThis.fetch = originalFetch
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
  if (vite) await vite.close()
  if (backend) await new Promise(resolve => backend.close(resolve))
  await disconnectDatabase()
  await database.stop()
  dom.window.close()
}
