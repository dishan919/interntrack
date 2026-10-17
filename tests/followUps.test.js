import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeFollowUp, getFollowUpStatus, getUpcomingFollowUps, updateFollowUp } from '../src/utils/followUpUtils.js'
import { applyApplicationUpdate } from '../src/utils/activityUtils.js'
import { getApplications, createApplication as postApplication, updateApplication as putApplication } from '../src/services/applicationService.js'
import { installApi } from './apiMock.js'

const legacy = { id: 'one', company: 'IFS', status: 'Applied', createdAt: '2026-10-01T09:00:00Z' }
const reminder = { date: '2026-10-15', note: 'Email HR', completed: false }
const today = new Date(2026, 9, 10, 23, 59)

test('missing and malformed follow-ups are safe and legacy applications remain unchanged', () => {
  for (const value of [undefined, null, {}, 'bad', { date: '2026-02-30' }, { date: 'bad', note: 3 }]) {
    assert.equal(normalizeFollowUp(value).date, '')
    assert.equal(getFollowUpStatus(value, today), null)
  }
  assert.deepEqual(applyApplicationUpdate(legacy, {}).activity, [])
  assert.equal(legacy.followUp, undefined)
})

test('creating a reminder preserves unrelated fields and records scheduling', () => {
  const next = applyApplicationUpdate(legacy, { followUp: reminder })
  assert.deepEqual(next.followUp, reminder)
  assert.equal(next.company, legacy.company)
  assert.equal(next.activity[0].type, 'follow_up_created')
  assert.match(next.activity[0].message, /scheduled for/)
  assert.equal(legacy.followUp, undefined)
})

test('updating date and note records one update', () => {
  const app = applyApplicationUpdate(legacy, { followUp: reminder })
  const next = applyApplicationUpdate(app, { followUp: { ...reminder, date: '2026-10-16', note: 'Call HR' } })
  assert.equal(next.activity.length, 2)
  assert.equal(next.activity[1].message, 'Follow-up reminder updated')
})

test('completing a reminder records completion and excludes it from pending', () => {
  const app = applyApplicationUpdate(legacy, { followUp: reminder })
  const next = applyApplicationUpdate(app, { followUp: { ...reminder, completed: true } })
  assert.equal(next.activity[1].message, 'Follow-up marked as completed')
  assert.equal(getFollowUpStatus(next.followUp, today).label, 'Completed')
  assert.deepEqual(getUpcomingFollowUps([next], today), [])
})

test('removing a reminder records removal', () => {
  const app = applyApplicationUpdate(legacy, { followUp: reminder })
  const next = applyApplicationUpdate(app, { followUp: null })
  assert.equal(next.followUp, null)
  assert.equal(next.activity[1].message, 'Follow-up reminder removed')
})

test('due today uses the local calendar day even at the end of the day', () => {
  assert.equal(getFollowUpStatus({ date: '2026-10-10' }, today).label, 'Due today')
})

test('future reminders distinguish tomorrow and multiple days', () => {
  assert.equal(getFollowUpStatus({ date: '2026-10-11' }, today).label, 'Due tomorrow')
  assert.equal(getFollowUpStatus({ date: '2026-10-13' }, today).label, 'Due in 3 days')
})

test('overdue reminders use singular and plural day labels', () => {
  assert.equal(getFollowUpStatus({ date: '2026-10-09' }, today).label, 'Overdue by 1 day')
  assert.equal(getFollowUpStatus({ date: '2026-10-08' }, today).label, 'Overdue by 2 days')
})

test('pending reminders sort nearest first, include overdue, and limit to five without mutation', () => {
  const apps = [18, 16, 8, 11, 12, 14].map(day => ({ ...legacy, id: String(day), followUp: { date: `2026-10-${String(day).padStart(2, '0')}` } }))
  const before = structuredClone(apps)
  assert.deepEqual(getUpcomingFollowUps([...apps, legacy, { ...legacy, followUp: { ...reminder, completed: true } }], today).map(app => app.id), ['8', '11', '12', '14', '16'])
  assert.deepEqual(apps, before)
})

test('unchanged normalized values produce no activity or persistence update', () => {
  const app = applyApplicationUpdate(legacy, { followUp: reminder })
  assert.deepEqual(applyApplicationUpdate(app, { followUp: { ...reminder, note: ' Email HR ' } }).activity, app.activity)
  let writes = 0
  assert.equal(updateFollowUp(app.id, reminder, () => app, () => writes++), false)
  assert.equal(writes, 0)
  assert.equal(updateFollowUp('missing', reminder, () => undefined, () => writes++), false)
  assert.equal(updateFollowUp(app.id, { ...reminder, completed: true }, () => app, () => writes++), true)
  assert.equal(writes, 1)
})

test('reminders and generated timeline events round-trip through REST without application browser writes', async () => {
  installApi()
  globalThis.localStorage = { getItem: () => { throw new Error('Unexpected browser read') }, setItem: () => { throw new Error('Unexpected browser write') } }
  const next = applyApplicationUpdate({ ...legacy, position: 'Intern' }, { followUp: reminder })
  const created = await postApplication(next)
  await postApplication({ ...legacy, position: 'Intern' })
  const loaded = await getApplications()
  assert.deepEqual(loaded[0].followUp, reminder)
  assert.deepEqual(loaded[0].activity, next.activity)
  assert.equal(loaded[1].followUp, undefined)
  await putApplication(created.id, applyApplicationUpdate(loaded[0], { followUp: null }))
  const removed = (await getApplications())[0]
  assert.equal(removed.followUp, null)
  assert.equal(removed.activity.at(-1).type, 'follow_up_removed')
})

test('calendar arithmetic handles leap days, year boundaries and DST without elapsed-hour rounding', () => {
  assert.equal(getFollowUpStatus({ date: '2028-03-01' }, new Date(2028, 1, 28)).daysRemaining, 2)
  assert.equal(getFollowUpStatus({ date: '2027-01-01' }, new Date(2026, 11, 31)).daysRemaining, 1)
  assert.equal(getFollowUpStatus({ date: '2026-03-09' }, new Date(2026, 2, 7, 23)).daysRemaining, 2)
  assert.equal(getFollowUpStatus(reminder, new Date('invalid')), null)
})
