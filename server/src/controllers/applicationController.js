import mongoose from 'mongoose'
import Application, { APPLICATION_STATUSES as statuses } from '../models/Application.js'

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof body.company !== 'string' || !body.company.trim() ||
      typeof body.position !== 'string' || !body.position.trim()) {
    return 'Company and position are required and must be non-empty strings'
  }
  if (Object.hasOwn(body, 'status') && !statuses.includes(body.status)) {
    return `Status must be one of: ${statuses.join(', ')}`
  }
}

function editableData(body) {
  const data = { ...body }
  for (const key of ['id', '_id', '__v']) delete data[key]
  return {
    ...data,
    company: body.company.trim(),
    position: body.position.trim(),
    status: body.status ?? 'Saved',
  }
}

export async function getApplications(_req, res) {
  res.status(200).json(await Application.find().sort({ _id: 1 }))
}

export async function getApplication(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(404).json({ message: 'Application not found' })
  const application = await Application.findById(req.params.id)
  if (!application) return res.status(404).json({ message: 'Application not found' })
  res.status(200).json(application)
}

export async function createApplication(req, res) {
  const error = validate(req.body)
  if (error) return res.status(400).json({ message: error })
  const application = await Application.create(editableData(req.body))
  res.status(201).location(`/api/applications/${application.id}`).json(application)
}

export async function updateApplication(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !await Application.exists({ _id: req.params.id })) {
    return res.status(404).json({ message: 'Application not found' })
  }
  const error = validate(req.body)
  if (error) return res.status(400).json({ message: error })
  const application = await Application.findOneAndReplace(
    { _id: req.params.id }, editableData(req.body), { returnDocument: 'after', runValidators: true },
  )
  if (!application) return res.status(404).json({ message: 'Application not found' })
  res.status(200).json(application)
}

export async function deleteApplication(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(404).json({ message: 'Application not found' })
  const application = await Application.findByIdAndDelete(req.params.id)
  if (!application) return res.status(404).json({ message: 'Application not found' })
  res.status(204).end()
}
