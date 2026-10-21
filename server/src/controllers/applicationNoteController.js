import mongoose from 'mongoose'
import Application, { MAX_NOTE_LENGTH } from '../models/Application.js'

const notFound = res => res.status(404).json({ message: 'Application or note not found' })
const validId = value => mongoose.isObjectIdOrHexString(value)

function textError(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => key !== 'text')) return 'Invalid note data'
  if (typeof body.text !== 'string' || !body.text.trim()) return 'Note text is required'
  if (body.text.trim().length > MAX_NOTE_LENGTH) return `Note text must be at most ${MAX_NOTE_LENGTH} characters`
}

async function changeNote(req, res, operation) {
  if (!validId(req.params.id) || (req.params.noteId !== undefined && !validId(req.params.noteId))) return notFound(res)
  const filter = { _id: req.params.id, owner: req.auth.userId }
  if (req.params.noteId) filter['applicationNotes._id'] = req.params.noteId
  // Check access before validating payloads; missing/foreign resources share 404.
  if (!await Application.exists(filter)) return notFound(res)
  if (operation !== 'delete') {
    const error = textError(req.body)
    if (error) return res.status(400).json({ message: error })
  }
  const now = new Date()
  const update = operation === 'create'
    ? { $push: { applicationNotes: { _id: new mongoose.Types.ObjectId(), text: req.body.text.trim(), createdAt: now, updatedAt: now } } }
    : operation === 'edit'
      ? { $set: { 'applicationNotes.$.text': req.body.text.trim(), 'applicationNotes.$.updatedAt': now } }
      : { $pull: { applicationNotes: { _id: req.params.noteId } } }
  const application = await Application.findOneAndUpdate(filter, update, { returnDocument: 'after', runValidators: true })
  if (!application) return notFound(res)
  return res.status(operation === 'create' ? 201 : 200).json(application)
}

export const createNote = (req, res) => changeNote(req, res, 'create')
export const editNote = (req, res) => changeNote(req, res, 'edit')
export const deleteNote = (req, res) => changeNote(req, res, 'delete')
