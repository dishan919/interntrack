import { DOCUMENTS, normalizeDocuments } from './documentUtils.js'
import { emptyInterview, getApplicationInterview } from './interviewUtils.js'

export function getActivityHistory(activity) {
  return Array.isArray(activity) ? activity : []
}

export function addActivity(activity, type, message, createdAt = new Date().toISOString()) {
  return [...getActivityHistory(activity), { id: crypto.randomUUID(), type, message, createdAt }]
}

export function createApplication(values) {
  const createdAt = new Date().toISOString()
  return { ...values, id: crypto.randomUUID(), createdAt, activity: addActivity([], 'created', 'Application created', createdAt) }
}

// Provider mutations use this merge, so every UI entry point records the same history.
export function applyApplicationUpdate(application, values) {
  const next = { ...application, ...values, id: application.id, createdAt: application.createdAt }
  let activity = getActivityHistory(application.activity)
  const createdAt = new Date().toISOString()
  if (next.status !== application.status) {
    activity = addActivity(activity, 'status_changed', `Status changed from ${application.status} to ${next.status}`, createdAt)
  }
  const beforeInterview = getApplicationInterview(application)
  const afterInterview = getApplicationInterview(next)
  if (Object.keys(emptyInterview).some(key => beforeInterview[key] !== afterInterview[key])) {
    const scheduled = !beforeInterview.date && afterInterview.date
    activity = addActivity(activity, scheduled ? 'interview_scheduled' : 'interview_changed', scheduled ? 'Interview scheduled' : 'Interview details changed', createdAt)
  }
  const beforeDocuments = normalizeDocuments(application.documents)
  const afterDocuments = normalizeDocuments(next.documents)
  for (const [key, label] of DOCUMENTS) {
    if (beforeDocuments[key] !== afterDocuments[key]) {
      activity = addActivity(activity, 'document_changed', `${label} marked ${afterDocuments[key] ? 'ready' : 'not ready'}`, createdAt)
    }
  }
  // Ignore history from edit-form values; it may be stale and must not overwrite events.
  return { ...next, activity }
}

export function getNewestActivity(activity) {
  return [...getActivityHistory(activity)].reverse().filter(item => item && typeof item.id === 'string' && typeof item.message === 'string' && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function formatActivityDate(createdAt) {
  return new Date(createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
