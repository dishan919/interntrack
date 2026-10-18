const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')
const safeValidationMessages = new Set([
  'Name is required', 'Name must be at most 120 characters',
  'A valid email address is required', 'Password must be at least 8 characters',
  'Password must be at most 72 UTF-8 bytes',
])

export async function register({ name, email, password }) {
  let response
  try {
    response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    })
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.')
  }
  if (response.status === 409) throw new Error('An account with this email already exists')
  if (!response.ok) {
    let message
    try { message = (await response.json()).message } catch { /* Use the safe fallback. */ }
    throw new Error(response.status === 400
      ? safeValidationMessages.has(message) ? message : 'Please check your details and try again.'
      : 'Unable to create your account right now. Please try again.')
  }
  let data
  try { data = await response.json() } catch { throw new Error('The server returned an invalid response. Please try again.') }
  if (!data?.user || !['id', 'name', 'email'].every(key => typeof data.user[key] === 'string')) {
    throw new Error('The server returned an invalid response. Please try again.')
  }
  // Retain only the safe registration contract, never token or password fields.
  const { id, name: userName, email: userEmail } = data.user
  return { user: { id, name: userName, email: userEmail } }
}

export async function login({ email, password }) {
  let response
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.')
  }
  if (response.status === 401) throw new Error('Invalid email or password')
  if (!response.ok) {
    throw new Error(response.status === 400
      ? 'Please check your email and password and try again.'
      : 'Unable to sign in right now. Please try again.')
  }
  let data
  try { data = await response.json() } catch { throw new Error('The server returned an invalid response. Please try again.') }
  if (!data?.user || !['id', 'name', 'email'].every(key => typeof data.user[key] === 'string')
    || typeof data.accessToken !== 'string' || !data.accessToken.trim()) {
    throw new Error('The server returned an invalid response. Please try again.')
  }
  const { id, name, email: userEmail } = data.user
  // Return the existing API contract in memory only; no storage or logging.
  return { user: { id, name, email: userEmail }, accessToken: data.accessToken }
}
