import { STATUSES } from './applications.js'
export const KANBAN_DRAG_TYPE = 'application/x-interntrack-application'
// Read the current Context record, then update only its status.
export function moveApplicationStatus(id, status, getApplication, updateApplication) {
  if (!STATUSES.includes(status)) return false
  const application = getApplication(id)
  if (!application || application.status === status) return false
  updateApplication(id, { status })
  return true
}
