export function validateProfile({ name, email }) {
  const errors = {}
  if (!name.trim()) errors.name = 'Name is required.'
  else if (name.trim().length > 120) errors.name = 'Use at most 120 characters.'
  if (!email.trim()) errors.email = 'Email is required.'
  else if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.'
  return errors
}
