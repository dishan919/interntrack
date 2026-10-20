import { bearerHeaders, invalidateSession } from './authSession.js'

const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')
function verificationState(user) {
  return typeof user.emailVerified === 'boolean' ? { emailVerified: user.emailVerified } : {}
}
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
  return { user: { id, name: userName, email: userEmail, ...verificationState(data.user) } }
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
  return { user: { id, name, email: userEmail, ...verificationState(data.user) }, accessToken: data.accessToken }
}

export async function getCurrentUser(accessToken) {
  let response
  try { response = await fetch(`${API_URL}/auth/me`, { headers: bearerHeaders(accessToken) }) }
  catch { throw new Error('Unable to verify your session. Please sign in again.') }
  if (!response.ok) throw new Error('Unable to verify your session. Please sign in again.')
  let data
  try { data = await response.json() } catch { throw new Error('The server returned an invalid response. Please sign in again.') }
  if (!data?.user || !['id', 'name', 'email'].every(key => typeof data.user[key] === 'string')) {
    throw new Error('The server returned an invalid response. Please sign in again.')
  }
  const { id, name, email } = data.user
  return { user: { id, name, email, ...verificationState(data.user) } }
}

export async function updateProfile(accessToken, updates) {
  const body = {}
  for (const key of ['name', 'email']) {
    if (Object.hasOwn(updates, key)) body[key] = typeof updates[key] === 'string' ? updates[key].trim() : updates[key]
  }
  let response
  try {
    response = await fetch(`${API_URL}/auth/me`, {
      method: 'PATCH', headers: { ...bearerHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  } catch { throw new Error('Unable to reach the server. Check your connection and try again.') }
  if (response.status === 401) {
    invalidateSession(accessToken)
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (response.status === 409) throw new Error('An account with this email already exists.')
  if (!response.ok) throw new Error(response.status === 400 ? 'Please check your name and email and try again.' : 'Unable to update your profile right now. Please try again.')
  let data
  try { data = await response.json() } catch { throw new Error('The server returned an invalid response. Please try again.') }
  if (!data?.user || !['id', 'name', 'email'].every(key => typeof data.user[key] === 'string' && data.user[key].trim())) throw new Error('The server returned an invalid response. Please try again.')
  const { id, name, email } = data.user
  return { user: { id, name, email, ...verificationState(data.user) } }
}

export async function changePassword(accessToken, { currentPassword, newPassword }) {
  let response
  try {
    response = await fetch(`${API_URL}/auth/password`, {
      method: 'PATCH', headers: { ...bearerHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  } catch { throw new Error('Unable to reach the server. Check your connection and try again.') }
  if (response.status === 401) {
    invalidateSession(accessToken)
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (!response.ok) {
    const safeMessages = new Set([
      'Current password is required', 'Current password is incorrect.',
      'New password must be at least 8 characters', 'New password must be at most 72 UTF-8 bytes',
      'New password must be different from the current password.',
    ])
    let message
    if (response.status === 400) {
      try { message = (await response.json()).message } catch { /* Use safe fallback. */ }
    }
    throw new Error(response.status === 400
      ? safeMessages.has(message) ? message : 'Please check your password details and try again.'
      : 'Unable to change your password right now. Please try again.')
  }
  let data
  try { data = await response.json() } catch { throw new Error('The server returned an invalid response. Please try again.') }
  if (data?.message !== 'Password changed successfully.') throw new Error('The server returned an invalid response. Please try again.')
  return { message: 'Password changed successfully.' }
}

export const RESET_REQUEST_MESSAGE = 'If an account exists for that email, password reset instructions have been sent.'
export const RESET_SUCCESS_MESSAGE = 'Password reset successfully. Please sign in with your new password.'
export const INVALID_RESET_MESSAGE = 'Password reset link is invalid or has expired.'
async function resetRequest(path, body, successMessage) {
  let response
  try {
    response = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  } catch { throw new Error('Unable to reach the server. Check your connection and try again.') }
  if (!response.ok) {
    const safe = new Set([INVALID_RESET_MESSAGE, 'A valid email address is required', 'New password must be at least 8 characters', 'New password must be at most 72 UTF-8 bytes'])
    let message
    if (response.status === 400) {
      try { message = (await response.json()).message } catch { /* Safe fallback. */ }
    }
    throw new Error(safe.has(message) ? message : 'Unable to process your request. Please try again.')
  }
  // Never forward server token/user fields to the page.
  return { message: successMessage }
}
export function requestPasswordReset(email) {
  return resetRequest('forgot-password', { email: email.trim() }, RESET_REQUEST_MESSAGE)
}
export function resetPassword(token, newPassword) {
  return resetRequest('reset-password', { token, newPassword }, RESET_SUCCESS_MESSAGE)
}

export const VERIFIED_MESSAGE = 'Email verified successfully.'
export const INVALID_VERIFICATION_MESSAGE = 'Email verification link is invalid or has expired.'
export const RESENT_MESSAGE = 'Verification instructions have been requested.'
export const ALREADY_VERIFIED_MESSAGE = 'Your email is already verified.'
async function verificationRequest(path, body, accessToken) {
  let response
  try {
    response = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST', headers: { ...bearerHeaders(accessToken ?? null), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  } catch { throw new Error('Unable to reach the server. Check your connection and try again.') }
  if (accessToken && response.status === 401) {
    invalidateSession(accessToken)
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (!response.ok) throw new Error(path === 'verify-email' && response.status === 400
    ? INVALID_VERIFICATION_MESSAGE : 'Unable to process verification. Please try again.')
  let data
  try { data = await response.json() } catch { throw new Error('The server returned an invalid response. Please try again.') }
  const messages = path === 'verify-email' ? [VERIFIED_MESSAGE] : [RESENT_MESSAGE, ALREADY_VERIFIED_MESSAGE]
  if (!messages.includes(data?.message)) throw new Error('The server returned an invalid response. Please try again.')
  return { message: data.message }
}
export function verifyEmail(token) {
  return verificationRequest('verify-email', { token })
}
export function resendEmailVerification(accessToken) {
  return verificationRequest('resend-verification', {}, accessToken)
}

export async function deleteAccount(accessToken, currentPassword) {
  let response
  try {
    response = await fetch(`${API_URL}/auth/me`, {
      method: 'DELETE', headers: { ...bearerHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword }),
    })
  } catch { throw new Error('Unable to reach the server. Check your connection and try again.') }
  if (response.status === 401) {
    invalidateSession(accessToken)
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (!response.ok) {
    const safe = new Set(['Current password is required', 'Current password is incorrect.'])
    let message
    if (response.status === 400) {
      try { message = (await response.json()).message } catch { /* Safe fallback. */ }
    }
    throw new Error(response.status === 409 ? 'Account changed. Please sign in again and retry.'
      : safe.has(message) ? message : 'Unable to delete your account right now. Please try again.')
  }
  let data
  try { data = await response.json() } catch { throw new Error('The server returned an invalid response. Please try again.') }
  if (data?.message !== 'Account deleted successfully.') throw new Error('The server returned an invalid response. Please try again.')
  return { message: 'Account deleted successfully.' }
}
