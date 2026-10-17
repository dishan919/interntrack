import { getDeadlineStatus } from './deadlineUtils.js'

export function normalizeFollowUp(value) {
  return {
    date: getDeadlineStatus(value?.date) ? value.date : '',
    note: typeof value?.note === 'string' ? value.note.trim() : '',
    completed: value?.completed === true,
  }
}

export function followUpsEqual(a, b) {
  const before = normalizeFollowUp(a)
  const after = normalizeFollowUp(b)
  return ['date', 'note', 'completed'].every(key => before[key] === after[key])
}

export function getFollowUpStatus(value, today = new Date()) {
  const followUp = normalizeFollowUp(value)
  const status = getDeadlineStatus(followUp.date, today)
  if (!status) return null
  const days = status.daysRemaining
  const label = followUp.completed ? 'Completed' : days < 0 ? `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`
  return { label, daysRemaining: days, tone: followUp.completed ? 'neutral' : status.tone }
}

export function getUpcomingFollowUps(applications, today = new Date(), limit = 5) {
  return applications.filter(app => {
    const followUp = normalizeFollowUp(app.followUp)
    return !followUp.completed && getFollowUpStatus(followUp, today)
  }).sort((a, b) => a.followUp.date.localeCompare(b.followUp.date)).slice(0, limit)
}

// Read the latest application and skip persistence when the reminder has not changed.
export function updateFollowUp(id, value, getApplication, updateApplication) {
  const application = getApplication(id)
  if (!application || followUpsEqual(application.followUp, value)) return false
  const followUp = normalizeFollowUp(value)
  const result = updateApplication(id, { followUp: followUp.date ? followUp : null })
  return result?.then ? result.then(Boolean) : true
}
