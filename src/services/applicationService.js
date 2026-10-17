const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')
const defaults = { position: '', location: '', jobUrl: '', appliedDate: '', interviewDate: '', notes: '', createdAt: '' }

async function request(path = '', method = 'GET', data) {
  let response
  try {
    response = await fetch(`${API_URL}/applications${path}`, {
      method,
      ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    })
  } catch {
    throw new Error('Unable to reach the applications server. Please check your connection and try again.')
  }
  if (!response.ok) {
    // Only expose known, safe messages; server diagnostics never reach the UI.
    const messages = { 400: 'Please check the application details and try again.', 404: 'Application not found. Reload applications and try again.' }
    throw new Error(messages[response.status] || 'Unable to save or load applications. Please try again.')
  }
  if (response.status === 204) return null
  try { return await response.json() } catch { throw new Error('The applications server returned an invalid response. Please try again.') }
}
const normalize = app => ({ ...defaults, ...app })
export async function getApplications() {
  const data = await request()
  if (!Array.isArray(data)) throw new Error('The applications server returned an invalid response. Please try again.')
  return data.map(normalize)
}
export async function getApplication(id) { return normalize(await request('/' + encodeURIComponent(id))) }
export async function createApplication(data) { return normalize(await request('', 'POST', data)) }
export async function updateApplication(id, data) { return normalize(await request('/' + encodeURIComponent(id), 'PUT', data)) }
export async function deleteApplication(id) { await request('/' + encodeURIComponent(id), 'DELETE') }

// Explicit import only. The legacy key is never used as live application state.
export async function importLegacyApplications() {
  const key = 'interntrack_applications'
  let records
  try {
    if (localStorage.getItem('interntrack_api_import_complete') === 'true') return
    records = JSON.parse(localStorage.getItem(key) || '[]')
  } catch { throw new Error('Unable to read the browser backup. Export it before making changes.') }
  if (!Array.isArray(records) || records.some(app => !app || typeof app.id !== 'string' || !app.id || typeof app.company !== 'string' || !app.company.trim() || typeof app.position !== 'string' || !app.position.trim())) {
    throw new Error('Browser records need valid company, position and ID values. Keep a backup and correct them before importing.')
  }
  const existing = await getApplications()
  const imported = new Set(existing.map(app => app.legacyBrowserId).filter(Boolean))
  for (const record of records) {
    if (!imported.has(record.id)) {
      await createApplication({ ...record, legacyBrowserId: record.id })
      imported.add(record.id)
    }
  }
  // Retain the original key as a backup; successful import is marked separately.
  try { localStorage.setItem('interntrack_api_import_complete', 'true') }
  catch { throw new Error('Records imported, but completion could not be saved in this browser. Keep the backup and retry with browser storage enabled.') }
}
