import Notification from '../models/Notification.js'
import { EVENTS } from './domainEvents.js'

export function registerNotificationObserver(publisher) {
  const save = (event, type, title, message, eventKey) => {
    const data = { user: event.userId, application: event.applicationId, type, title, message }
    return eventKey
      ? Notification.updateOne({ user: event.userId, eventKey }, { $setOnInsert: { ...data, eventKey } }, { upsert: true, runValidators: true })
      : Notification.create(data)
  }
  const company = event => event.company.slice(0, 120)
  const unsubscribe = [
    publisher.subscribe(EVENTS.STATUS_CHANGED, event => {
      // The publisher emits only genuine persisted changes, in either direction.
      return save(event, 'status', `Application: ${event.newStatus}`, `${company(event)}: status changed from ${event.previousStatus} to ${event.newStatus}.`)
    }),
    publisher.subscribe(EVENTS.INTERVIEW_SCHEDULED, event => save(event, 'interview', 'Interview scheduled', `${company(event)}: interview scheduled for ${event.date}${event.time ? ' at ' + event.time : ''}.`)),
    publisher.subscribe(EVENTS.FOLLOW_UP_DUE, event => save(event, 'followUp', 'Follow-up due', `${company(event)}: your follow-up for ${event.date} is due.`, `followUp:${event.applicationId}:${event.date}`)),
  ]
  return () => unsubscribe.forEach(remove => remove())
}
