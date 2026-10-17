import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyInterview, formatInterviewTime, getApplicationInterview, getInterviewStageLabel, getInterviewStatus, getUpcomingInterviews, hasInterviewDetails, isSafeMeetingLink, prepareInterviewValues, validateInterview } from '../src/utils/interviewUtils.js'
import { getApplications } from '../src/services/applicationService.js'
import { installApi } from './apiMock.js'
const now = new Date(2026, 9, 15, 10, 0)

test('interview labels and eligibility consider local dates and times', () => {
  assert.equal(getInterviewStatus({ date: '2026-10-14' }, now).label, 'Past')
  assert.equal(getInterviewStatus({ date: '2026-10-15', time: '09:30' }, now).label, 'Past')
  assert.equal(getInterviewStatus({ date: '2026-10-15', time: '10:30' }, now).label, 'Today')
  assert.equal(getInterviewStatus({ date: '2026-10-16', time: '00:00' }, now).label, 'Tomorrow')
  assert.equal(getInterviewStatus({ date: '2026-10-18' }, now).label, 'In 3 days')
  assert.equal(getInterviewStatus({ date: '2026-10-15', time: '10:00' }, now).upcoming, true)
  assert.equal(getInterviewStatus({ date: '2026-10-15', time: '10:00' }, new Date(2026, 9, 15, 10, 0, 1)).upcoming, false)
})

test('date-only interviews remain upcoming through their local calendar day', () => {
  assert.equal(getInterviewStatus({ date: '2026-10-15' }, new Date(2026, 9, 15, 23, 59, 59, 999)).label, 'Today')
  assert.equal(getInterviewStatus({ date: '2026-10-15' }, new Date(2026, 9, 16, 0, 0)).label, 'Past')
  assert.equal(getInterviewStatus({ date: '2027-01-01' }, new Date(2026, 11, 31, 23)).label, 'Tomorrow')
  assert.equal(getInterviewStatus({ date: '2026-03-09', time: '09:00' }, new Date(2026, 2, 7, 23)).label, 'In 2 days')
})

test('optional interviews and old interviewDate values work without mutation', () => {
  const old = { id: 'old', company: 'WSO2', status: 'Applied' }
  const before = JSON.stringify(old)
  assert.deepEqual(getApplicationInterview(old), emptyInterview)
  assert.equal(hasInterviewDetails(getApplicationInterview(old)), false)
  assert.equal(getInterviewStatus(getApplicationInterview(old), now), null)
  assert.equal(JSON.stringify(old), before)
  assert.equal(getApplicationInterview({ interviewDate: '2026-10-16' }).date, '2026-10-16')
  assert.equal(getApplicationInterview({ interviewDate: '2026-10-16', interview: { date: '' } }).date, '')
  assert.equal(getApplicationInterview({ interview: { stage: 'Technical' } }).stage, 'Technical Interview')
  assert.equal(getInterviewStageLabel('HR'), 'HR Interview')
  assert.equal(getInterviewStageLabel('Final'), 'Final Interview')
})

test('upcoming interviews sort by date/time, retain stable ties, and limit to five', () => {
  const apps = [
    { id: 'later', interview: { date: '2026-10-16', time: '10:30' } },
    { id: 'no-time', interview: { date: '2026-10-15' } },
    { id: 'past', interview: { date: '2026-10-15', time: '09:00' } },
    { id: 'late-today', interview: { date: '2026-10-15', time: '14:00' } },
    { id: 'soon', interview: { date: '2026-10-15', time: '10:30' } },
    { id: 'tie', interview: { date: '2026-10-15', time: '10:30' } },
    { id: 'tomorrow', interview: { date: '2026-10-16', time: '09:00' } },
    { id: 'invalid', interview: { date: '2026-02-30', time: '10:30' } },
    { id: 'none' },
  ]
  const before = JSON.stringify(apps)
  assert.deepEqual(getUpcomingInterviews(apps, now).map(item => item.application.id), ['soon', 'tie', 'late-today', 'no-time', 'tomorrow'])
  assert.equal(JSON.stringify(apps), before)
})

test('Online, On-site, and Phone fields validate and round-trip through form preparation', () => {
  for (const type of ['Online', 'On-site', 'Phone']) {
    const interview = { ...emptyInterview, date: '2026-10-16', time: '10:30', type, stage: 'Technical Interview', meetingLink: type === 'Online' ? 'https://meet.google.com/example' : '', location: type === 'On-site' ? 'Colombo office' : '', notes: 'Prepare React' }
    assert.equal(validateInterview(interview), '')
    const submitted = prepareInterviewValues({ company: 'WSO2', interview })
    assert.deepEqual(submitted.interview, interview)
    assert.equal(submitted.interviewDate, interview.date)
  }
  assert.equal(validateInterview(emptyInterview), '')
  assert.equal(prepareInterviewValues({ interview: emptyInterview }).interview, undefined)
  assert.equal(prepareInterviewValues({ interview: emptyInterview }).interviewDate, '')
  assert.equal(hasInterviewDetails({ ...emptyInterview, notes: 'Prepare React' }), true)
})

test('invalid dates, times, and unsafe meeting URLs are rejected', () => {
  for (const date of ['2026-02-29', '2026-13-01', 'not-a-date']) assert.ok(validateInterview({ ...emptyInterview, date }))
  for (const time of ['24:00', '10:60', '9:30', 'bad']) {
    assert.ok(validateInterview({ ...emptyInterview, time }))
    assert.equal(getInterviewStatus({ date: '2026-10-16', time }, now), null)
    assert.equal(formatInterviewTime(time), '')
  }
  for (const link of ['javascript:alert(1)', 'https://', '/relative', 'file:///test']) {
    assert.equal(isSafeMeetingLink(link), false)
    assert.ok(validateInterview({ ...emptyInterview, type: 'Online', meetingLink: link }))
  }
  assert.equal(isSafeMeetingLink('https://meet.google.com/example'), true)
  assert.equal(formatInterviewTime(''), '')
  assert.ok(formatInterviewTime('00:00'))
  assert.ok(formatInterviewTime('23:59'))
  if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/New_York') {
    assert.ok(validateInterview({ ...emptyInterview, date: '2026-03-08', time: '02:30' }))
  }
})

test('minimal legacy API records gain display defaults without writes and retain rich interviews', async () => {
  const data = [{ id: 'APP001', company: 'WSO2', status: 'Applied' }, { id: 'APP002', company: 'IFS', position: 'Intern', status: 'Applied', interview: { date: '2026-10-15', time: '10:30', type: 'Online', stage: 'Technical', meetingLink: 'https://meet.google.com/example' } }]
  const original = JSON.stringify(data)
  const store = new Map([['interntrack_applications', original]])
  const calls = installApi(store)
  const loaded = await getApplications()
  assert.equal(loaded.length, 2)
  assert.equal(loaded[0].position, '')
  assert.deepEqual(loaded[1].interview, data[1].interview)
  assert.equal(store.get('interntrack_applications'), original)
  assert.deepEqual(calls.map(call => call.method), ['GET'])
})