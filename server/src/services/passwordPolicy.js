import bcrypt from 'bcryptjs'
import { MIN_PASSWORD_LENGTH } from '../models/User.js'
export function passwordError(value, label = 'Password') {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH || !value.trim()) return `${label} must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (bcrypt.truncates(value)) return `${label} must be at most 72 UTF-8 bytes`
}
