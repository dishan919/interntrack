import { getDeadlineStatus } from './deadlineUtils.js'
export const INTERVIEW_STAGES = ['HR Interview', 'Technical Interview', 'Final Interview', 'Other']
export const INTERVIEW_TYPES = ['Online', 'On-site', 'Phone']
export const emptyInterview = { date: '', time: '', type: '', stage: '', location: '', meetingLink: '', notes: '' }
export function getInterviewStageLabel(stage) {
  return { HR: 'HR Interview', Technical: 'Technical Interview', Final: 'Final Interview' }[stage] || stage || ''
}
// Read legacy dates in memory; never migrate or write storage while displaying data.
export function getApplicationInterview(application) {
  const stored = application.interview && typeof application.interview === 'object' ? application.interview : {}
  return { ...emptyInterview, ...stored, date: stored.date ?? application.interviewDate ?? '', stage: getInterviewStageLabel(stored.stage) }
}
export function hasInterviewDetails(interview) {
  return !!interview && Object.keys(emptyInterview).some(key => typeof interview[key] === 'string' && interview[key].trim())
}
function validTime(time) { return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) }
export function isSafeMeetingLink(link) {
  if (typeof link !== 'string' || !/^https?:\/\//i.test(link)) return false
  try {
    const url = new URL(link)
    return ['https:', 'http:'].includes(url.protocol) && !!url.hostname
  } catch { return false }
}
// Interviews use the browser's local timezone, matching native date/time inputs.
function scheduledTime(interview) {
  if (!interview?.date || !getDeadlineStatus(interview.date) || (interview.time && !validTime(interview.time))) return null
  const [year, month, day] = interview.date.split('-').map(Number)
  const [hour, minute] = interview.time ? interview.time.split(':').map(Number) : [23, 59]
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(hour, minute, interview.time ? 0 : 59, interview.time ? 0 : 999)
  // Reject impossible local times instead of silently shifting them during DST.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null
  return date.getTime()
}
export function getInterviewStatus(interview, now = new Date()) {
  const timestamp = scheduledTime(interview)
  const calendar = getDeadlineStatus(interview?.date, now)
  if (timestamp === null || !calendar) return null
  const upcoming = timestamp >= now.getTime()
  const daysRemaining = calendar.daysRemaining
  const label = !upcoming ? 'Past' : daysRemaining === 0 ? 'Today' : daysRemaining === 1 ? 'Tomorrow' : 'In ' + daysRemaining + ' days'
  return { label, upcoming, daysRemaining, timestamp }
}
export function formatInterviewTime(time) {
  if (!validTime(time)) return ''
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, hour, minute)
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
export function getUpcomingInterviews(applications, now = new Date(), limit = 5) {
  return applications.map(application => {
    const interview = getApplicationInterview(application)
    return { application, interview, status: getInterviewStatus(interview, now) }
  }).filter(item => item.status?.upcoming).sort((a, b) => a.status.timestamp - b.status.timestamp).slice(0, limit)
}
export function validateInterview(interview) {
  if (interview.date && !getDeadlineStatus(interview.date)) return 'Enter a valid interview date.'
  if (interview.time && !validTime(interview.time)) return 'Enter a valid interview time.'
  if (interview.date && scheduledTime(interview) === null) return 'This interview time does not exist on that date in your local timezone.'
  if (interview.type === 'Online' && interview.meetingLink && !isSafeMeetingLink(interview.meetingLink)) return 'Enter a valid meeting link starting with https:// or http://.'
  return ''
}
// Used by the shared Add/Edit form. Empty sections do not create phantom interviews.
export function prepareInterviewValues(values) {
  const interview = { ...values.interview, meetingLink: values.interview.meetingLink.trim(), location: values.interview.location.trim() }
  return { ...values, interviewDate: interview.date, interview: hasInterviewDetails(interview) ? interview : undefined }
}
