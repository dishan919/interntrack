import mongoose from 'mongoose'

export const MAX_USER_AGENT_LENGTH = 512
const loginActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loggedInAt: { type: Date, required: true, default: Date.now },
  ipAddress: { type: String, maxlength: 45, default: '' },
  userAgent: { type: String, maxlength: MAX_USER_AGENT_LENGTH, default: '' },
}, {
  versionKey: false,
  bufferCommands: false,
  toJSON: {
    transform(_doc, result) {
      return { id: result._id.toString(), loggedInAt: result.loggedInAt, ipAddress: result.ipAddress, userAgent: result.userAgent }
    },
  },
})
loginActivitySchema.index({ user: 1, loggedInAt: -1, _id: -1 })
export default mongoose.model('LoginActivity', loginActivitySchema)
