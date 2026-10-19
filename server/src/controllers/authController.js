import bcrypt from 'bcryptjs'
import { createAccessToken, getJwtSecret } from '../config/jwt.js'
import User, { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '../models/User.js'

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid registration data'
  if (typeof body.name !== 'string' || !body.name.trim()) return 'Name is required'
  if (body.name.trim().length > 120) return 'Name must be at most 120 characters'
  if (typeof body.email !== 'string' || body.email.trim().length > 254 || !EMAIL_PATTERN.test(body.email.trim())) {
    return 'A valid email address is required'
  }
  if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH || !body.password.trim()) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (bcrypt.truncates(body.password)) return 'Password must be at most 72 UTF-8 bytes'
}

export async function register(req, res) {
  const error = validate(req.body)
  if (error) return res.status(400).json({ message: error })
  const email = req.body.email.trim().toLowerCase()
  const duplicate = () => res.status(409).json({ message: 'An account with this email already exists' })
  try {
    // Wait for the unique index before accepting even the first registration.
    await User.init()
    if (await User.exists({ email })) return duplicate()
    const user = await User.create({ name: req.body.name.trim(), email, password: req.body.password })
    return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } })
  } catch (failure) {
    // The database index also handles concurrent requests that pass the lookup.
    if (failure.code === 11000) return duplicate()
    throw failure
  }
}

export async function login(req, res) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ message: 'Invalid login data' })
  }
  if (typeof body.email !== 'string' || body.email.trim().length > 254 || !EMAIL_PATTERN.test(body.email.trim())) {
    return res.status(400).json({ message: 'A valid email address is required' })
  }
  if (typeof body.password !== 'string' || !body.password.trim()) {
    return res.status(400).json({ message: 'Password is required' })
  }

  const email = body.email.trim().toLowerCase()
  const invalid = () => res.status(401).json({ message: 'Invalid email or password' })
  // Reject truncation so a longer password cannot match a valid 72-byte prefix.
  if (bcrypt.truncates(body.password)) return invalid()
  const user = await User.findOne({ email }).select('+password')
  if (!user || !await bcrypt.compare(body.password, user.password)) return invalid()
  const secret = getJwtSecret()
  if (!secret) return res.status(503).json({ message: 'Authentication is not configured' })
  const accessToken = createAccessToken(user.id, secret)
  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email }, accessToken })
}

export async function me(req, res) {
  const user = await User.findById(req.auth.userId)
  if (!user) return res.status(401).json({ message: 'Unauthorized' })
  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } })
}

export async function updateMe(req, res) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ message: 'Invalid profile data' })
  const updates = {}
  if (Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) return res.status(400).json({ message: 'Name is required' })
    if (body.name.trim().length > 120) return res.status(400).json({ message: 'Name must be at most 120 characters' })
    updates.name = body.name.trim()
  }
  if (Object.hasOwn(body, 'email')) {
    if (typeof body.email !== 'string' || body.email.trim().length > 254 || !EMAIL_PATTERN.test(body.email.trim())) return res.status(400).json({ message: 'A valid email address is required' })
    updates.email = body.email.trim().toLowerCase()
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Provide a name or email to update' })
  try {
    await User.init()
    // Explicit $set allowlist and verified identity; never spread client data.
    const user = await User.findByIdAndUpdate(req.auth.userId, { $set: updates }, { returnDocument: 'after', runValidators: true })
    if (!user) return res.status(401).json({ message: 'Unauthorized' })
    return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } })
  } catch (failure) {
    if (failure.code === 11000) return res.status(409).json({ message: 'An account with this email already exists' })
    throw failure
  }
}

export async function changePassword(req, res) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !['currentPassword', 'newPassword'].includes(key))) {
    return res.status(400).json({ message: 'Invalid password change data' })
  }
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.trim()) return res.status(400).json({ message: 'Current password is required' })
  if (typeof body.newPassword !== 'string' || body.newPassword.length < MIN_PASSWORD_LENGTH || !body.newPassword.trim()) {
    return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` })
  }
  if (bcrypt.truncates(body.newPassword)) return res.status(400).json({ message: 'New password must be at most 72 UTF-8 bytes' })
  const user = await User.findById(req.auth.userId).select('+password')
  if (!user) return res.status(401).json({ message: 'Unauthorized' })
  // Reject bcrypt truncation matches; passwords retain their exact whitespace.
  if (bcrypt.truncates(body.currentPassword) || !await bcrypt.compare(body.currentPassword, user.password)) {
    return res.status(400).json({ message: 'Current password is incorrect.' })
  }
  if (body.newPassword === body.currentPassword) return res.status(400).json({ message: 'New password must be different from the current password.' })
  user.password = body.newPassword
  await user.save() // The existing pre-save hook hashes once with bcrypt cost 12.
  return res.status(200).json({ message: 'Password changed successfully.' })
}
