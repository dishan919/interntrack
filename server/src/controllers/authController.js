import bcrypt from 'bcryptjs'
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
  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } })
}
