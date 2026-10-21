import mongoose from 'mongoose'

const { Schema } = mongoose
export const APPLICATION_STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']
export const MAX_NOTE_LENGTH = 2000

const noteSchema = new Schema({
  text: { type: String, required: true, trim: true, maxlength: MAX_NOTE_LENGTH },
}, {
  strict: 'throw',
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform(_doc, result) {
      return { id: result._id.toString(), text: result.text, createdAt: result.createdAt, updatedAt: result.updatedAt }
    },
  },
})

const applicationSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
  applicationNotes: { type: [noteSchema], default: undefined },
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
      delete result.owner
      delete result.__v
      return result
    },
  },
})

export default mongoose.model('Application', applicationSchema)
