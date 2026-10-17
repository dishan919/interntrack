import assert from 'node:assert/strict'
import test from 'node:test'
import { getDeadlineStatus, getUpcomingDeadlines, sortByDeadline } from '../src/utils/deadlineUtils.js'
import { getApplications, updateApplication as putApplication, deleteApplication as removeApplication } from '../src/services/applicationService.js'
import { installApi } from './apiMock.js'

const today = new Date(2026, 9, 20, 23, 59, 59)

test('calendar-day labels handle expired, today, tomorrow and future dates', () => {
  assert.equal(getDeadlineStatus('2026-10-19', today).label, 'Expired')
  assert.equal(getDeadlineStatus('2026-10-20', today).label, 'Deadline today')
  assert.equal(getDeadlineStatus('2026-10-21', today).label, 'Tomorrow')
  assert.equal(getDeadlineStatus('2026-10-23', today).label, '3 days left')
  assert.equal(getDeadlineStatus('2026-10-30', today).label, '10 days left')
  assert.equal(getDeadlineStatus('2026-10-20', new Date(2026, 9, 20, 0, 0)).daysRemaining, 0)
  assert.equal(getDeadlineStatus('2026-10-20', new Date(2026, 9, 21, 0, 0)).label, 'Expired')
  assert.equal(getDeadlineStatus('2026-11-01', new Date(2026, 9, 31, 23, 50)).label, 'Tomorrow')
  assert.equal(getDeadlineStatus('2027-01-01', new Date(2026, 11, 31, 23, 50)).label, 'Tomorrow')
})

test('calendar arithmetic handles daylight saving and leap years', () => {
  assert.equal(getDeadlineStatus('2026-03-09', new Date(2026, 2, 7, 23, 50)).daysRemaining, 2)
  assert.equal(getDeadlineStatus('2026-11-02', new Date(2026, 9, 31, 23, 50)).daysRemaining, 2)
  assert.equal(getDeadlineStatus('2028-03-01', new Date(2028, 1, 28, 23, 50)).daysRemaining, 2)
})

test('missing, empty and invalid deadlines have no indicator', () => {
  for (const value of [undefined, null, '', 'not-a-date', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10']) {
    assert.equal(getDeadlineStatus(value, today), null)
  }
  assert.equal(getDeadlineStatus('2028-02-29', new Date(2028, 1, 28)).label, 'Tomorrow')
})

test('search, status filter and sorting compose without mutating source records', () => {
  const apps = [
    { id: 'late', company: 'IFS', position: 'React Intern', status: 'Applied', deadline: '2026-10-30' },
    { id: 'none', company: 'IFS', position: 'React Intern', status: 'Applied' },
    { id: 'early', company: 'IFS', position: 'React Intern', status: 'Applied', deadline: '2026-10-21' },
    { id: 'other', company: 'WSO2', position: 'React Intern', status: 'Applied', deadline: '2026-10-20' },
    { id: 'status', company: 'IFS', position: 'React Intern', status: 'Interview', deadline: '2026-10-20' },
    { id: 'empty', company: 'IFS', position: 'React Intern', status: 'Applied', deadline: '' },
  ]
  const before = JSON.stringify(apps)
  const filtered = apps.filter(app => (app.company + ' ' + app.position).toLowerCase().includes('ifs') && app.status === 'Applied')
  assert.deepEqual(sortByDeadline(filtered, 'soonest').map(app => app.id), ['early', 'late', 'none', 'empty'])
  assert.deepEqual(sortByDeadline(filtered, 'latest').map(app => app.id), ['late', 'early', 'none', 'empty'])
  assert.deepEqual(sortByDeadline(filtered).map(app => app.id), ['late', 'none', 'early', 'empty'])
  assert.equal(JSON.stringify(apps), before)
})

test('upcoming deadlines exclude expired and missing dates and show the closest five', () => {
  const apps = [{ id: 'expired', deadline: '2026-10-19' }, { id: 'none' }, ...[27, 26, 25, 24, 23, 22, 21, 20].map(day => ({ id: String(day), deadline: '2026-10-' + day }))]
  const before = JSON.stringify(apps)
  assert.deepEqual(getUpcomingDeadlines(apps, today).map(app => app.id), ['20', '21', '22', '23', '24'])
  assert.equal(JSON.stringify(apps), before)
})

test('legacy deadlines stay optional and API updates, clearing, and empty reloads persist', async () => {
  const records = [{ id: 'APP001', company: 'WSO2', position: 'Intern', status: 'Applied' }, { id: 'APP002', company: 'IFS', position: 'Intern', status: 'Applied', deadline: '2026-10-25' }]
  const store = new Map([['interntrack_applications', JSON.stringify(records)]])
  const calls = installApi(store)
  const loaded = await getApplications()
  assert.equal(loaded[0].deadline, undefined)
  assert.equal(loaded[0].notes, '')
  assert.equal(calls.length, 1)
  await putApplication(loaded[0].id, { ...loaded[0], deadline: '2026-10-30' })
  let reloaded = await getApplications()
  assert.equal(reloaded[0].deadline, '2026-10-30')
  assert.equal(reloaded[0].status, 'Applied')
  assert.equal(reloaded[1].deadline, '2026-10-25')
  for (const app of reloaded) await putApplication(app.id, { ...app, deadline: '' })
  reloaded = await getApplications()
  assert.ok(reloaded.every(app => app.deadline === ''))
  for (const app of reloaded) await removeApplication(app.id)
  assert.deepEqual(await getApplications(), [])
})