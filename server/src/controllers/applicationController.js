import { randomUUID } from 'node:crypto'
import applications from '../data/applications.js'

const statuses = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']

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

function editableData(body, id) {
  return {
    ...body,
    company: body.company.trim(),
    position: body.position.trim(),
    status: body.status ?? 'Saved',
    id,
  }
}

export function getApplications(_req, res) {
  res.status(200).json(applications)
}

export function getApplication(req, res) {
  const application = applications.find(item => item.id === req.params.id)
  if (!application) return res.status(404).json({ message: 'Application not found' })
  res.status(200).json(application)
}

export function createApplication(req, res) {
  const error = validate(req.body)
  if (error) return res.status(400).json({ message: error })
  const application = editableData(req.body, randomUUID())
  applications.push(application)
  res.status(201).location(`/api/applications/${application.id}`).json(application)
}

export function updateApplication(req, res) {
  const index = applications.findIndex(item => item.id === req.params.id)
  if (index === -1) return res.status(404).json({ message: 'Application not found' })
  const error = validate(req.body)
  if (error) return res.status(400).json({ message: error })
  const application = editableData(req.body, applications[index].id)
  applications[index] = application
  res.status(200).json(application)
}

export function deleteApplication(req, res) {
  const index = applications.findIndex(item => item.id === req.params.id)
  if (index === -1) return res.status(404).json({ message: 'Application not found' })
  applications.splice(index, 1)
  res.status(204).end()
}
