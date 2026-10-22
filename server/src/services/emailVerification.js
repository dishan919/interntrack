import { createHash, randomBytes } from 'node:crypto'
import { createTokenDelivery } from './testTokenDelivery.js'
import { photoUrl } from './profilePhotoStorage.js'

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
export const INVALID_VERIFICATION_MESSAGE = 'Email verification link is invalid or has expired.'
export const VERIFIED_MESSAGE = 'Email verified successfully.'
export const RESENT_MESSAGE = 'Verification instructions have been requested.'
export const ALREADY_VERIFIED_MESSAGE = 'Your email is already verified.'
export const hashVerificationToken = token => createHash('sha256').update(token).digest('hex')
export function createVerification() {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS)
  return { token, expiresAt, fields: { emailVerified: false, emailVerificationTokenHash: hashVerificationToken(token), emailVerificationExpiresAt: expiresAt } }
}
const delivery = createTokenDelivery()
export const setTestVerificationCapture = delivery.setCapture
export const deliverEmailVerification = delivery.deliver
export function safeUser(user) {
  const profilePhotoUrl = photoUrl(user.profilePhoto)
  return { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified === true, ...(profilePhotoUrl ? { profilePhotoUrl } : {}) }
}
