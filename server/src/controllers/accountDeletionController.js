import LoginActivity from '../models/LoginActivity.js'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import Application from '../models/Application.js'
import { withAccountOperation } from '../services/accountOperations.js'
import { removeProfilePhoto } from '../services/profilePhotoStorage.js'

export async function deleteAccount(req, res) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => key !== 'currentPassword')) {
    return res.status(400).json({ message: 'Invalid account deletion data' })
  }
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.trim()) {
    return res.status(400).json({ message: 'Current password is required' })
  }
  return withAccountOperation(req.auth.userId, async () => {
    const user = await User.findById(req.auth.userId).select('+password')
    if (!user) return res.status(401).json({ message: 'Unauthorized' })
    if (bcrypt.truncates(body.currentPassword) || !await bcrypt.compare(body.currentPassword, user.password)) {
      return res.status(400).json({ message: 'Current password is incorrect.' })
    }
    // Cleanup first: never deliberately remove the user after failed cleanup.
    // The shared account queue prevents concurrent application writes here.
    await Application.deleteMany({ owner: req.auth.userId })
    await LoginActivity.deleteMany({ user: req.auth.userId })
    await removeProfilePhoto(user.profilePhoto)
    // A concurrent password change/reset must not authorize deletion with an old hash.
    const result = await User.deleteOne({ _id: req.auth.userId, password: user.password })
    if (result.deletedCount !== 1) return res.status(409).json({ message: 'Account changed. Please sign in again and retry.' })
    return res.json({ message: 'Account deleted successfully.' })
  })
}
