import { bearerHeaders, invalidateSession } from './authSession.js'
import { photoState } from '../utils/profilePhoto.js'

const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')
export async function changeProfilePhoto(token, file) {
  const body = file ? new FormData() : undefined
  if (file) body.append('photo', file)
  let response
  try {
    response = await fetch(`${API_URL}/auth/me/photo`, { method: file ? 'POST' : 'DELETE', headers: bearerHeaders(token), ...(body ? { body } : {}) })
  } catch { throw new Error('Unable to update your photo. Please try again.') }
  if (response.status === 401) { invalidateSession(token); throw new Error('Your session has expired. Please sign in again.') }
  if (!response.ok) throw new Error(response.status === 413 ? 'Photo must be at most 2 MB.' : response.status === 400 ? 'Choose a valid JPEG, PNG or WebP photo up to 2 MB.' : 'Unable to update your photo. Please try again.')
  let data
  try { data = await response.json() } catch { throw new Error('Unable to update your photo. Please try again.') }
  const user = data?.user
  if (!user || !['id', 'name', 'email'].every(key => typeof user[key] === 'string') || (file && !photoState(user).profilePhotoUrl)) throw new Error('Unable to update your photo. Please try again.')
  return { user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified === true, ...photoState(user) } }
}
