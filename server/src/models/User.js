import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { isManagedPhoto } from '../services/profilePhotoStorage.js'

export const MIN_PASSWORD_LENGTH = 8
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const userSchema = new mongoose.Schema({
  profilePhoto: { type: String, validate: isManagedPhoto },
  emailVerified: { type: Boolean, default: false },
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpiresAt: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: {
    type: String, required: true, trim: true, lowercase: true,
    unique: true, maxlength: 254, match: EMAIL_PATTERN,
  },
  password: {
    type: String, required: true, select: false, minlength: MIN_PASSWORD_LENGTH,
    validate: value => typeof value === 'string' && Boolean(value.trim()) && !bcrypt.truncates(value),
  },
}, {
  timestamps: true,
  versionKey: false,
  bufferCommands: false,
  toJSON: {
    transform(_doc, result) {
      result.id = result._id.toString()
      delete result._id
      delete result.emailVerificationTokenHash
      delete result.emailVerificationExpiresAt
      delete result.passwordResetTokenHash
      delete result.passwordResetExpiresAt
      delete result.password
      delete result.profilePhoto
      return result
    },
  },
})

// Validation runs before this hook. Never trim passwords or hash an unchanged hash.
userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12)
  if (this.$where?.passwordResetTokenHash) this.$where.passwordResetExpiresAt = { $gt: new Date() }
})

export default mongoose.model('User', userSchema)
