import { validatePasswordChange } from './passwordChange.js'
export function validateResetPassword(values) {
  const errors = validatePasswordChange({ ...values, currentPassword: '' })
  delete errors.currentPassword
  return errors
}
export function validateResetEmail(email) {
  if (!email.trim()) return 'Email is required.'
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
}
