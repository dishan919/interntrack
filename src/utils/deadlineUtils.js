const DAY = 24 * 60 * 60 * 1000
// Treat YYYY-MM-DD as a calendar day, not a UTC timestamp displayed locally.
function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.getTime() / DAY
}
export function getDeadlineStatus(deadline, today = new Date()) {
  const dueDay = calendarDay(deadline)
  if (dueDay === null || Number.isNaN(today.getTime())) return null
  // Use the browser's local calendar date; UTC arithmetic avoids 23/25-hour DST days.
  const currentDay = calendarDay(String(today.getFullYear()).padStart(4, '0') + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0'))
  const daysRemaining = dueDay - currentDay
  const label = daysRemaining < 0 ? 'Expired' : daysRemaining === 0 ? 'Deadline today' : daysRemaining === 1 ? 'Tomorrow' : daysRemaining + ' days left'
  const tone = daysRemaining < 0 ? 'expired' : daysRemaining <= 3 ? 'urgent' : 'neutral'
  return { daysRemaining, label, tone }
}
export function sortByDeadline(applications, order = 'default') {
  const sorted = [...applications]
  if (order !== 'soonest' && order !== 'latest') return sorted
  return sorted.sort((a, b) => {
    const aDay = calendarDay(a.deadline)
    const bDay = calendarDay(b.deadline)
    // Missing deadlines stay at the end in both directions. Ties retain their order.
    if (aDay === null) return bDay === null ? 0 : 1
    if (bDay === null) return -1
    return order === 'latest' ? bDay - aDay : aDay - bDay
  })
}
export function getUpcomingDeadlines(applications, today = new Date(), limit = 5) {
  return sortByDeadline(applications.filter(app => {
    const status = getDeadlineStatus(app.deadline, today)
    return status && status.daysRemaining >= 0
  }), 'soonest').slice(0, limit)
}
