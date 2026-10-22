import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['status', 'interview', 'followUp'], required: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 400 },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  read: { type: Boolean, default: false, required: true },
  // Only due reminders need durable deduplication, including across restarts.
  eventKey: { type: String },
}, { timestamps: true, versionKey: false, bufferCommands: false })
notificationSchema.index({ user: 1, createdAt: -1, _id: -1 })
notificationSchema.index({ user: 1, read: 1 })
notificationSchema.index({ user: 1, eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } })
export default mongoose.model('Notification', notificationSchema)
