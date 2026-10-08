import { sampleApplications, STATUSES } from '../utils/applications.js'
const STORAGE_KEY = 'interntrack_applications'
// Validate stored data before using it in the UI.
export function isApplication(app) {
  return app && typeof app.id === 'string' && typeof app.company === 'string' && typeof app.position === 'string' && STATUSES.includes(app.status) && ['location', 'jobUrl', 'appliedDate', 'interviewDate', 'notes', 'createdAt'].every(key => typeof app[key] === 'string') && ['appliedDate', 'interviewDate'].every(key => !app[key] || /^\d{4}-\d{2}-\d{2}$/.test(app[key]))
}
export function loadApplications() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return { applications: sampleApplications, error: saveApplications(sampleApplications) }
    const data = JSON.parse(stored)
    if (!Array.isArray(data) || !data.every(isApplication)) throw new Error('Invalid data')
    return { applications: data, error: '' }
  } catch {
    return { applications: [], error: 'Your saved data could not be read. Storage may be unavailable or the saved data may be damaged. Export any visible data before making changes.' }
  }
}
export function saveApplications(applications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
    return ''
  } catch {
    return 'Changes are visible for this session, but could not be saved. Export a backup before closing this page.'
  }
}
