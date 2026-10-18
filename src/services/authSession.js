export const TOKEN_KEY = 'interntrack_access_token'
let accessToken = null
const listeners = new Set()

export function readStoredToken() {
  try { return window.sessionStorage.getItem(TOKEN_KEY) || null } catch { return null }
}
export function storeToken(token) {
  try { window.sessionStorage.setItem(TOKEN_KEY, token) }
  catch { throw new Error('Session storage is unavailable. Allow session storage and try again.') }
}
export function removeStoredToken() {
  try { window.sessionStorage.removeItem(TOKEN_KEY) } catch { /* In-memory logout still applies. */ }
}
export function getAccessToken() { return accessToken }
export function setAccessToken(token) { accessToken = token }
export function bearerHeaders(token = accessToken) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
export function onUnauthorized(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function invalidateSession(token) {
  // An old request must never log out a newer session.
  if (!token || token !== accessToken) return
  accessToken = null
  removeStoredToken()
  for (const listener of listeners) listener()
}
