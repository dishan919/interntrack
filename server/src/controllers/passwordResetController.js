import { createHash, randomBytes } from 'node:crypto'
import User, { EMAIL_PATTERN } from '../models/User.js'
import { passwordError } from '../services/passwordPolicy.js'
import { deliverPasswordReset } from '../services/passwordResetDelivery.js'

export const RESET_TTL_MS = 15 * 60 * 1000
export const RESET_REQUEST_MESSAGE = 'If an account exists for that email, password reset instructions have been sent.'
export const INVALID_RESET_MESSAGE = 'Password reset link is invalid or has expired.'
const hashToken = token => createHash('sha256').update(token).digest('hex')

export async function forgotPassword(req, res) {
  const email = req.body?.email
  if (typeof email !== 'string' || email.trim().length > 254 || !EMAIL_PATTERN.test(email.trim())) return res.status(400).json({ message: 'A valid email address is required' })
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TTL_MS)
  const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, {
    $set: { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: expiresAt },
  }, { returnDocument: 'after' })
  if (user) await deliverPasswordReset({ email: user.email, token, expiresAt })
  return res.json({ message: RESET_REQUEST_MESSAGE })
}

export async function resetPassword(req, res) {
  const invalid = () => res.status(400).json({ message: INVALID_RESET_MESSAGE })
  const body = req.body
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !['token', 'newPassword'].includes(key))) return invalid()
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return invalid()
  const error = passwordError(body.newPassword, 'New password')
  if (error) return res.status(400).json({ message: error })
  const passwordResetTokenHash = hashToken(body.token)
  const user = await User.findOne({ passwordResetTokenHash, passwordResetExpiresAt: { $gt: new Date() } })
  if (!user) return invalid()
  user.password = body.newPassword
  user.passwordResetTokenHash = undefined
  user.passwordResetExpiresAt = undefined
  // save() uses the established bcrypt hook, with an atomic token/expiry predicate.
  // A concurrent reset, replacement token or expiry while hashing prevents this write.
  user.$where = { passwordResetTokenHash, passwordResetExpiresAt: { $gt: new Date() } }
  try { await user.save() }
  catch (failure) {
    if (failure.name === 'DocumentNotFoundError') return invalid()
    throw failure
  }
  return res.json({ message: 'Password reset successfully. Please sign in with your new password.' })
}
