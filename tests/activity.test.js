import assert from 'node:assert/strict'
import test from 'node:test'
import { addActivity, applyApplicationUpdate, createApplication, formatActivityDate, getActivityHistory, getNewestActivity } from '../src/utils/activityUtils.js'
import { getApplications, updateApplication as putApplication } from '../src/services/applicationService.js'
import { installApi } from './apiMock.js'

const legacy = { id: 'one', company: 'IFS', status: 'Applied', notes: 'Keep this', createdAt: '2026-10-01T09:00:00Z' }

test('missing and malformed history is safely treated as empty', () => {
  for (const activity of [undefined, null, {}, '']) {
    assert.deepEqual(getActivityHistory(activity), [])
    assert.deepEqual(getNewestActivity(activity), [])
  }
  assert.deepEqual(applyApplicationUpdate(legacy, { notes: 'Edited' }).activity, [])
  assert.equal(legacy.activity, undefined)
})

test('adding an activity produces the required fields without mutating history', () => {
  const history = []
  const next = addActivity(history, 'created', 'Application created', legacy.createdAt)
  assert.deepEqual(history, [])
  assert.equal(next.length, 1)
  assert.equal(typeof next[0].id, 'string')
  assert.ok(next[0].id.length)
  assert.deepEqual(Object.keys(next[0]).sort(), ['createdAt', 'id', 'message', 'type'])
  assert.equal(next[0].type, 'created')
  assert.equal(next[0].message, 'Application created')
  assert.equal(next[0].createdAt, legacy.createdAt)
  const second = addActivity(next, 'status_changed', 'Status changed')
  assert.notEqual(second[1].id, next[0].id)
  assert.ok(Number.isFinite(Date.parse(second[1].createdAt)))
})

test('new applications receive a single creation event with the application timestamp', () => {
  const application = createApplication({ company: 'IFS', status: 'Saved', notes: 'Keep this' })
  assert.equal(application.company, 'IFS')
  assert.equal(application.notes, 'Keep this')
  assert.ok(application.id)
  assert.equal(application.activity.length, 1)
  assert.equal(application.activity[0].type, 'created')
  assert.equal(application.activity[0].message, 'Application created')
  assert.equal(application.activity[0].createdAt, application.createdAt)
})

test('status changes record old and new values and preserve application identity and history', () => {
  const application = { ...legacy, activity: addActivity([], 'created', 'Application created') }
  const before = structuredClone(application)
  const next = applyApplicationUpdate(application, { status: 'Interview', id: 'other', createdAt: 'other', activity: [] })
  assert.equal(next.activity.length, 2)
  assert.deepEqual(next.activity[0], before.activity[0])
  assert.equal(next.activity[1].type, 'status_changed')
  assert.equal(next.activity[1].message, 'Status changed from Applied to Interview')
  assert.equal(next.id, legacy.id)
  assert.equal(next.createdAt, legacy.createdAt)
  assert.equal(next.notes, legacy.notes)
  assert.deepEqual(application, before)
})

test('unchanged status, interview, and document values create no duplicate events', () => {
  const application = {
    ...legacy, interviewDate: '2026-10-20',
    interview: { date: '2026-10-20', stage: 'HR' },
    documents: { resume: true }, activity: addActivity([], 'created', 'Application created'),
  }
  const next = applyApplicationUpdate(application, {
    status: 'Applied', interviewDate: '2026-10-20',
    interview: { date: '2026-10-20', time: '', stage: 'HR Interview', type: '', location: '', meetingLink: '', notes: '' },
    documents: { resume: true, coverLetter: false, portfolio: false, transcript: false },
  })
  assert.deepEqual(next.activity, application.activity)
  assert.deepEqual(applyApplicationUpdate(next, next).activity, application.activity)
  assert.deepEqual(applyApplicationUpdate(legacy, { interview: undefined, interviewDate: '', documents: { resume: false } }).activity, [])
})

test('interview scheduling, edits, removal and legacy dates generate useful events', () => {
  const scheduled = applyApplicationUpdate(legacy, { interview: { date: '2026-10-20', time: '10:00' }, interviewDate: '2026-10-20' })
  assert.equal(scheduled.activity[0].type, 'interview_scheduled')
  assert.equal(scheduled.activity[0].message, 'Interview scheduled')
  const edited = applyApplicationUpdate(scheduled, { interview: { ...scheduled.interview, time: '11:00', meetingLink: 'https://example.com' } })
  assert.equal(edited.activity[1].message, 'Interview details changed')
  const removed = applyApplicationUpdate(edited, { interview: undefined, interviewDate: '' })
  assert.equal(removed.activity[2].type, 'interview_changed')
  const oldDate = { ...legacy, interviewDate: '2026-10-20' }
  assert.equal(applyApplicationUpdate(oldDate, { interviewDate: '2026-10-21' }).activity[0].type, 'interview_changed')
  assert.deepEqual(applyApplicationUpdate(oldDate, { interview: { date: '2026-10-20' } }).activity, [])
})

test('document changes record readiness in both directions alongside other simultaneous changes', () => {
  const next = applyApplicationUpdate(legacy, { status: 'Interview', documents: { resume: true, coverLetter: true } })
  assert.deepEqual(next.activity.map(item => item.message), [
    'Status changed from Applied to Interview', 'Resume / CV marked ready', 'Cover Letter marked ready',
  ])
  const unchecked = applyApplicationUpdate(next, { documents: { ...next.documents, resume: false } })
  assert.equal(unchecked.activity.at(-1).message, 'Resume / CV marked not ready')
  assert.equal(unchecked.activity.at(-1).type, 'document_changed')
  assert.equal(unchecked.activity.length, 4)
})

test('timeline sorts newest first without mutating saved order and handles invalid entries', () => {
  const early = { id: 'early', message: 'Early', createdAt: '2026-10-01T08:00:00Z' }
  const late = { id: 'late', message: 'Late', createdAt: '2026-10-02T08:00:00Z' }
  const tie = { ...late, id: 'tie' }
  const history = [late, early, tie, null, { id: 'invalid', message: 'Invalid', createdAt: 'bad-date' }]
  const before = structuredClone(history)
  assert.deepEqual(getNewestActivity(history).map(item => item.id), ['tie', 'late', 'early'])
  assert.deepEqual(history, before)
  assert.equal(formatActivityDate(early.createdAt), new Date(early.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }))
})

test('legacy history stays absent on load; REST updates persist new events and isolate records', async () => {
  const other = { ...legacy, id: 'two', company: 'WSO2' }
  const store = new Map([['interntrack_applications', JSON.stringify([legacy, other])]])
  const calls = installApi(store)
  const loaded = await getApplications()
  assert.equal(loaded[0].activity, undefined)
  assert.equal(loaded[0].position, '')
  assert.deepEqual(calls.map(call => call.method), ['GET'])
  const updated = applyApplicationUpdate(loaded[0], { status: 'Interview', documents: { transcript: true } })
  await putApplication(updated.id, updated)
  const reloaded = await getApplications()
  assert.deepEqual(reloaded[0].activity, updated.activity)
  assert.equal(reloaded[0].notes, legacy.notes)
  assert.deepEqual(reloaded[1], loaded[1])
})