import Application from '../models/Application.js'
import { domainEvents, EVENTS } from './domainEvents.js'

export function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function interview(application) {
  return { date: application?.interview?.date ?? application?.interviewDate, time: application?.interview?.time || '' }
}
// Explicit allowlist: neither raw requests nor whole documents enter the bus.
export async function publishApplicationEvents(userId, before, after) {
  const payload = { userId, applicationId: after.id, company: after.company.slice(0, 120) }
  if (before && before.status !== after.status) {
    await domainEvents.publish(EVENTS.STATUS_CHANGED, { ...payload, previousStatus: before.status, newStatus: after.status })
  }
  const previous = interview(before)
  const next = interview(after)
  if (validCalendarDate(next.date) && (!next.time || /^([01]\d|2[0-3]):[0-5]\d$/.test(next.time)) && (previous.date !== next.date || previous.time !== next.time)) {
    await domainEvents.publish(EVENTS.INTERVIEW_SCHEDULED, { ...payload, date: next.date, time: next.time })
  }
  await publishDueFollowUp(userId, after)
}
export async function publishDueFollowUp(userId, application, today = new Date().toISOString().slice(0, 10)) {
  const followUp = application.followUp
  if (followUp?.completed === true || !validCalendarDate(followUp?.date) || followUp.date > today) return
  await domainEvents.publish(EVENTS.FOLLOW_UP_DUE, { userId, applicationId: application.id, company: application.company.slice(0, 120), date: followUp.date })
}
export async function discoverDueFollowUps(userId) {
  const today = new Date().toISOString().slice(0, 10)
  // Calendar dates are stored as YYYY-MM-DD. UTC defines server reminder days.
  const applications = await Application.find({ owner: userId, 'followUp.completed': { $ne: true }, 'followUp.date': { $type: 'string', $lte: today } })
    .select('company followUp')
  for (const application of applications) await publishDueFollowUp(userId, application, today)
}
