const localPhotoPattern = /^\/api\/profile-photos\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/
export function photoState(user) {
  return typeof user.profilePhotoUrl === 'string' && localPhotoPattern.test(user.profilePhotoUrl) ? { profilePhotoUrl: user.profilePhotoUrl } : {}
}
export function photoSource(reference) {
  if (!localPhotoPattern.test(reference || '')) return null
  const api = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api'
  try { return new URL(reference, new URL(api, globalThis.location?.origin || 'http://localhost')).href } catch { return null }
}
export function photoFileError(file) {
  if (!file) return 'Choose a photo first.'
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP photo.'
  if (!file.size || file.size > 2 * 1024 * 1024) return 'Photo must be nonempty and at most 2 MB.'
}
