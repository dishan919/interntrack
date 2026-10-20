import User from '../models/User.js'
import { createVerification, deliverEmailVerification, hashVerificationToken, INVALID_VERIFICATION_MESSAGE, VERIFIED_MESSAGE, RESENT_MESSAGE, ALREADY_VERIFIED_MESSAGE } from '../services/emailVerification.js'

export async function verifyEmail(req, res) {
  const body = req.body
  const invalid = () => res.status(400).json({ message: INVALID_VERIFICATION_MESSAGE })
  if (!body || Array.isArray(body) || Object.keys(body).some(key => key !== 'token')
    || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return invalid()
  // One atomic match/update guarantees one-time consumption and safe resend races.
  const user = await User.findOneAndUpdate({
    emailVerified: { $ne: true }, emailVerificationTokenHash: hashVerificationToken(body.token),
    emailVerificationExpiresAt: { $gt: new Date() },
  }, {
    $set: { emailVerified: true },
    $unset: { emailVerificationTokenHash: '', emailVerificationExpiresAt: '' },
  }, { returnDocument: 'after' })
  if (!user) return invalid()
  return res.json({ message: VERIFIED_MESSAGE })
}

export async function resendVerification(req, res) {
  if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length) return res.status(400).json({ message: 'Invalid verification request' })
  const current = await User.findById(req.auth.userId)
  if (!current) return res.status(401).json({ message: 'Unauthorized' })
  if (current.emailVerified === true) return res.json({ message: ALREADY_VERIFIED_MESSAGE })
  const verification = createVerification()
  const user = await User.findOneAndUpdate({ _id: req.auth.userId, email: current.email, emailVerified: { $ne: true } }, {
    $set: verification.fields,
  }, { returnDocument: 'after' })
  if (!user) {
    const current = await User.findById(req.auth.userId)
    if (!current) return res.status(401).json({ message: 'Unauthorized' })
    if (current.emailVerified === true) return res.json({ message: ALREADY_VERIFIED_MESSAGE })
    return res.status(409).json({ message: 'Account changed. Please try again.' })
  }
  await deliverEmailVerification({ email: user.email, token: verification.token, expiresAt: verification.expiresAt })
  return res.json({ message: RESENT_MESSAGE })
}
