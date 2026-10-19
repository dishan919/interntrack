export function validatePasswordChange({ currentPassword, newPassword, confirmNewPassword }) {
  const errors = {}
  if (!currentPassword.trim()) errors.currentPassword = 'Current password is required.'
  if (!newPassword.trim()) errors.newPassword = 'New password is required.'
  else if (newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.'
  else if (new TextEncoder().encode(newPassword).length > 72) errors.newPassword = 'Use at most 72 UTF-8 bytes.'
  else if (newPassword === currentPassword) errors.newPassword = 'New password must be different from the current password.'
  if (!confirmNewPassword) errors.confirmNewPassword = 'Confirm your new password.'
  else if (confirmNewPassword !== newPassword) errors.confirmNewPassword = 'Passwords must match.'
  return errors
}
