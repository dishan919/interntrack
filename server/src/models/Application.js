import mongoose from 'mongoose'

const { Schema } = mongoose
export const APPLICATION_STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']

const applicationSchema = new Schema({
  company: { type: String, required: true, trim: true },
  position: { type: String, required: true, trim: true },
  status: { type: String, enum: APPLICATION_STATUSES, default: 'Saved', required: true },
  // Preserve the frontend's date strings and optional JSON shapes without coercion.
  location: Schema.Types.Mixed,
  jobUrl: Schema.Types.Mixed,
  appliedDate: Schema.Types.Mixed,
  deadline: Schema.Types.Mixed,
  interviewDate: Schema.Types.Mixed,
  interview: Schema.Types.Mixed,
  notes: Schema.Types.Mixed,
  skills: Schema.Types.Mixed,
  documents: Schema.Types.Mixed,
  activity: Schema.Types.Mixed,
  followUp: Schema.Types.Mixed,
  createdAt: Schema.Types.Mixed,
}, {
  strict: false,
  minimize: false,
  versionKey: false,
  bufferCommands: false,
  toJSON: {
    transform(_doc, result) {
      result.id = result._id.toString()
      delete result._id
      delete result.__v
      return result
    },
  },
})

export default mongoose.model('Application', applicationSchema)
