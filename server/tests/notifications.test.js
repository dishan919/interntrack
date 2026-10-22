import assert from 'node:assert/strict'
import { before, beforeEach, after, test } from 'node:test'
import { once } from 'node:events'
import jwt from 'jsonwebtoken'
import app from '../src/app.js'
import User from '../src/models/User.js'
import Application, { APPLICATION_STATUSES } from '../src/models/Application.js'
import Notification from '../src/models/Notification.js'
import { domainEvents, EVENTS } from '../src/services/domainEvents.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'

let database, server, base, a, b, tokenA, tokenB
const originalSecret = process.env.JWT_SECRET
const password = 'NotificationPassword123'
const today = () => new Date().toISOString().slice(0, 10)
const auth = token => ({ Authorization: `Bearer ${token}` })
async function request(path = '', method = 'GET', token = tokenA, body) {
  return fetch(`${base}/api/notifications${path}`, { method, headers: { ...(token ? auth(token) : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
async function applicationRequest(id, body, token = tokenA) {
  const response = await fetch(`${base}/api/applications${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { response, data: await response.json() }
}
async function record(user = a, fields = {}) { return Notification.create({ user: user.id, type: 'status', title: 'Application: Interview', message: 'Private company interview', ...fields }) }
before(async () => {
  process.env.JWT_SECRET = 'disposable-notification-test-secret'
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  await Notification.init()
  a = await User.create({ name: 'A', email: 'notification-a@example.com', password })
  b = await User.create({ name: 'B', email: 'notification-b@example.com', password })
  tokenA = jwt.sign({ sub: a.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  tokenB = jwt.sign({ sub: b.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
})
beforeEach(async () => { await Notification.deleteMany({}); await Application.deleteMany({}) })
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  await disconnectDatabase()
  if (database) await database.stop()
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

test('all notification endpoints require valid JWT and a live account', async () => {
  const deleted = jwt.sign({ sub: '0123456789abcdef01234567' }, process.env.JWT_SECRET)
  const expired = jwt.sign({ sub: a.id }, process.env.JWT_SECRET, { expiresIn: -1 })
  for (const token of [null, 'invalid', expired, deleted]) {
    assert.equal((await request('', 'GET', token)).status, 401)
    assert.equal((await request('/read-all', 'PATCH', token)).status, 401)
    assert.equal((await request('/0123456789abcdef01234567/read', 'PATCH', token)).status, 401)
  }
})

test('list is private, newest-first with stable ties, bounded to 50 and counts all unread', async () => {
  const entries = await Notification.insertMany(Array.from({ length: 55 }, (_, index) => ({ user: a.id, type: 'status', title: `Notification ${index}`, message: 'A only', createdAt: new Date(2026, 0, 1, 0, index), read: index === 0 })))
  await record(b, { message: 'B private' })
  const response = await request('?userId=' + b.id)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const data = await response.json()
  assert.equal(data.notifications.length, 50)
  assert.equal(data.unreadCount, 54)
  assert.deepEqual(data.notifications.map(item => item.id), entries.slice(5).reverse().map(item => item.id))
  assert.deepEqual(Object.keys(data.notifications[0]).sort(), ['createdAt', 'id', 'message', 'read', 'title', 'type'])
  assert.doesNotMatch(JSON.stringify(data), /B private|eventKey|password|token|user|owner/)
  const tie = new Date('2027-01-01T00:00:00Z')
  const first = await record(a, { createdAt: tie })
  const second = await record(a, { createdAt: tie })
  assert.deepEqual((await (await request()).json()).notifications.slice(0, 2).map(item => item.id), [second.id, first.id])
})

test('mark one is scoped, idempotent, rejects ownership payloads and handles malformed IDs', async () => {
  const own = await record(), foreign = await record(b)
  for (const id of ['invalid', '123', foreign.id, '0123456789abcdef01234567']) {
    const response = await request(`/${id}/read`, 'PATCH')
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { message: 'Notification not found' })
  }
  assert.equal((await request(`/${own.id}/read`, 'PATCH', tokenA, { userId: b.id })).status, 400)
  assert.equal((await request(`/${own.id}/read`, 'PATCH')).status, 200)
  assert.equal((await request(`/${own.id}/read`, 'PATCH')).status, 200)
  assert.equal((await Notification.findById(own.id)).read, true)
  assert.equal((await Notification.findById(foreign.id)).read, false)
  assert.equal((await (await request()).json()).unreadCount, 0)
})

test('mark-all affects only authenticated user, including records outside visible 50', async () => {
  await Notification.insertMany(Array.from({ length: 55 }, () => ({ user: a.id, type: 'status', title: 'A', message: 'A' })))
  const foreign = await record(b)
  assert.equal((await request('/read-all', 'PATCH', tokenA, { owner: b.id })).status, 400)
  assert.equal((await request('/read-all', 'PATCH')).status, 200)
  assert.equal(await Notification.countDocuments({ user: a.id, read: false }), 0)
  assert.equal((await Notification.findById(foreign.id)).read, false)
  assert.equal((await (await request('', 'GET', tokenB)).json()).unreadCount, 1)
})

test('successful status update publishes minimal trusted payload and creates expected notification', async () => {
  const created = await applicationRequest(null, { company: 'Company A', position: 'Intern' })
  const payloads = []
  const unsubscribe = domainEvents.subscribe(EVENTS.STATUS_CHANGED, payload => payloads.push(payload))
  try {
    const result = await applicationRequest(created.data.id, { ...created.data, status: 'Interview', owner: b.id, userId: b.id, password: 'secret', notes: 'private note' })
    assert.equal(result.response.status, 200)
    assert.deepEqual(payloads, [{ userId: a.id, applicationId: created.data.id, company: 'Company A', previousStatus: 'Saved', newStatus: 'Interview' }])
    assert.equal(await Notification.countDocuments({ user: b.id }), 0)
    const data = await (await request()).json()
    assert.equal(data.unreadCount, 1)
    assert.equal(data.notifications[0].title, 'Application: Interview')
    assert.equal(data.notifications[0].applicationId, created.data.id)
    assert.match(data.notifications[0].message, /Company A.*Saved to Interview/)
    assert.doesNotMatch(JSON.stringify(payloads), /password|secret|private note|notes/)
  } finally { unsubscribe() }
})

test('Interview -> Applied publishes committed before/after status and persists exactly one private notification', async () => {
  const created = await applicationRequest(null, { company: 'Reverse Co', position: 'Intern', status: 'Interview' })
  assert.equal(created.response.status, 201)
  assert.equal(await Notification.countDocuments({}), 0)
  const events = []
  const unsubscribe = domainEvents.subscribe(EVENTS.STATUS_CHANGED, async payload => {
    const committed = await Application.findById(payload.applicationId)
    events.push({ payload, committedStatus: committed.status })
  })
  try {
    const result = await applicationRequest(created.data.id, { ...created.data, status: 'Applied' })
    assert.equal(result.response.status, 200)
    assert.deepEqual(events, [{ payload: { userId: a.id, applicationId: created.data.id, company: 'Reverse Co', previousStatus: 'Interview', newStatus: 'Applied' }, committedStatus: 'Applied' }])
    const notifications = await Notification.find({ user: a.id, application: created.data.id }).lean()
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].type, 'status')
    assert.equal(notifications[0].title, 'Application: Applied')
    assert.equal(notifications[0].message, 'Reverse Co: status changed from Interview to Applied.')
    assert.equal(notifications[0].read, false)
    assert.equal(notifications[0].eventKey, undefined)
    const listed = await (await request()).json()
    assert.equal(listed.unreadCount, 1)
    assert.equal(listed.notifications.length, 1)
    assert.equal(listed.notifications[0].id, String(notifications[0]._id))
    assert.equal(listed.notifications[0].applicationId, created.data.id)
    assert.deepEqual(await (await request('', 'GET', tokenB)).json(), { notifications: [], unreadCount: 0 })
    // An unchanged save and repeated list refresh must not replay the status event.
    assert.equal((await applicationRequest(created.data.id, { ...result.data, notes: 'minor edit' })).response.status, 200)
    await request()
    assert.equal(events.length, 1)
    assert.equal(await Notification.countDocuments({}), 1)
  } finally { unsubscribe() }
})

test('every valid status transition creates one notification, including repeated reverse transitions', async () => {
  let total = 0
  for (const previousStatus of APPLICATION_STATUSES) {
    for (const newStatus of APPLICATION_STATUSES.filter(status => status !== previousStatus)) {
      const application = await Application.create({ owner: a.id, company: 'Transitions Co', position: 'Intern', status: previousStatus })
      const result = await applicationRequest(application.id, { company: application.company, position: application.position, status: newStatus })
      assert.equal(result.response.status, 200)
      const notifications = await Notification.find({ application: application.id, user: a.id })
      assert.equal(notifications.length, 1, `${previousStatus} -> ${newStatus}`)
      assert.equal(notifications[0].message, `Transitions Co: status changed from ${previousStatus} to ${newStatus}.`)
      assert.equal((await applicationRequest(application.id, result.data)).response.status, 200)
      assert.equal(await Notification.countDocuments({ application: application.id }), 1)
      total++
    }
  }
  assert.equal(await Notification.countDocuments({}), total)
  // Returning to the same status on a later genuine change is a new event,
  // unlike due reminders, which have a durable deduplication key.
  const created = await applicationRequest(null, { company: 'Repeat Co', position: 'Intern', status: 'Interview' })
  for (const status of ['Applied', 'Interview', 'Applied']) {
    assert.equal((await applicationRequest(created.data.id, { ...created.data, status })).response.status, 200)
  }
  assert.equal(await Notification.countDocuments({ application: created.data.id }), 3)
  assert.equal(await Notification.countDocuments({ user: b.id }), 0)
})

test('validation, ownership and database update failures publish no status-change event', async t => {
  const created = await applicationRequest(null, { company: 'Failed Co', position: 'Intern', status: 'Interview' })
  const events = []
  const unsubscribe = domainEvents.subscribe(EVENTS.STATUS_CHANGED, payload => events.push(payload))
  try {
    assert.equal((await applicationRequest(created.data.id, { company: '', position: 'Intern', status: 'Applied' })).response.status, 400)
    assert.equal((await applicationRequest(created.data.id, { ...created.data, status: 'Applied' }, tokenB)).response.status, 404)
    t.mock.method(Application, 'findOneAndUpdate', async () => { throw new Error('private update failure') })
    const failed = await applicationRequest(created.data.id, { ...created.data, status: 'Applied' })
    assert.equal(failed.response.status, 500)
    assert.deepEqual(failed.data, { message: 'Internal server error' })
    assert.equal((await Application.findById(created.data.id)).status, 'Interview')
    assert.deepEqual(events, [])
    assert.equal(await Notification.countDocuments({}), 0)
  } finally { unsubscribe() }
})

test('interview scheduling and date/time rescheduling notify, notes and unchanged saves do not spam', async () => {
  const data = { company: 'Interview Co', position: 'Intern', interview: { date: '2028-01-02', time: '10:30' } }
  const created = await applicationRequest(null, data)
  assert.equal(created.response.status, 201)
  assert.equal(await Notification.countDocuments({ type: 'interview' }), 1)
  await applicationRequest(created.data.id, { ...data, interview: { ...data.interview, notes: 'changed' }, documents: { cv: true }, notes: 'edit' })
  assert.equal(await Notification.countDocuments({}), 1)
  await applicationRequest(created.data.id, { ...data, interview: { ...data.interview, time: '11:30' } })
  assert.equal(await Notification.countDocuments({ type: 'interview' }), 2)
  await applicationRequest(created.data.id, { ...data, interview: { date: '2028-02-31', time: '11:30' } })
  assert.equal(await Notification.countDocuments({}), 2)
})

test('minor edits with unchanged status and failed updates create no notifications', async () => {
  const created = await applicationRequest(null, { company: 'Quiet Co', position: 'Intern' })
  await applicationRequest(created.data.id, { ...created.data, notes: 'edited', activity: [{ message: 'Interview scheduled' }] })
  await applicationRequest(created.data.id, { company: '', position: 'Intern', status: 'Interview' })
  assert.equal((await applicationRequest(created.data.id, { ...created.data, status: 'Interview' }, tokenB)).response.status, 404)
  assert.equal(await Notification.countDocuments({}), 0)
})

test('due follow-ups are discovered on refresh, deduplicated persistently, and isolated', async () => {
  await Application.create({ owner: a.id, company: 'Due Co', position: 'Intern', followUp: { date: today(), completed: false, note: 'private reminder' } })
  await Application.create({ owner: b.id, company: 'B due', position: 'Intern', followUp: { date: today() } })
  for (const followUp of [{ date: '2999-01-01' }, { date: today(), completed: true }, { date: '2026-02-31' }]) await Application.create({ owner: a.id, company: 'Ignore', position: 'Intern', followUp })
  for (let index = 0; index < 3; index++) assert.equal((await (await request()).json()).unreadCount, 1)
  const item = await Notification.findOne({ user: a.id })
  assert.equal(item.type, 'followUp')
  assert.doesNotMatch(item.message, /private reminder/)
  await request(`/${item.id}/read`, 'PATCH')
  assert.equal((await (await request()).json()).unreadCount, 0)
  assert.equal(await Notification.countDocuments({ user: b.id }), 0)
  assert.equal((await (await request('', 'GET', tokenB)).json()).unreadCount, 1)
})

test('observer persistence failure does not undo successful application update and logs only safe warning', async t => {
  const created = await applicationRequest(null, { company: 'Failure Co', position: 'Intern' })
  const warnings = []
  t.mock.method(console, 'warn', message => warnings.push(message))
  t.mock.method(Notification, 'create', async () => { throw new Error('private database details') })
  const result = await applicationRequest(created.data.id, { ...created.data, status: 'Offer' })
  assert.equal(result.response.status, 200)
  assert.equal((await Application.findById(created.data.id)).status, 'Offer')
  assert.deepEqual(warnings, ['Domain event observer failed.'])
})

test('deleted or foreign related applications never produce navigation references', async () => {
  const foreign = await Application.create({ owner: b.id, company: 'B', position: 'Intern' })
  await record(a, { application: foreign.id })
  await record(a, { application: '0123456789abcdef01234567' })
  const data = await (await request()).json()
  assert.ok(data.notifications.every(item => !item.applicationId))
})

test('unexpected notification query/update errors have generic safe responses', async t => {
  t.mock.method(Notification, 'find', () => { throw new Error('private diagnostics') })
  const response = await request()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
})

test('notification cleanup failure retains the account and returns a safe deletion error', async t => {
  const own = await record(), foreign = await record(b)
  t.mock.method(Notification, 'deleteMany', async () => { throw new Error('private cleanup details') })
  const response = await fetch(`${base}/api/auth/me`, { method: 'DELETE', headers: { ...auth(tokenA), 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: password }) })
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Internal server error' })
  assert.ok(await User.findById(a.id))
  assert.ok(await Notification.findById(own.id))
  assert.ok(await Notification.findById(foreign.id))
})

test('in-flight notification creation finishes before account deletion cleanup', async t => {
  const user = await User.create({ name: 'Queued', email: 'notification-queue@example.com', password })
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  const created = await applicationRequest(null, { company: 'Queued Co', position: 'Intern' }, token)
  let release, entered
  const started = new Promise(resolve => { entered = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const originalCreate = Notification.create.bind(Notification)
  t.mock.method(Notification, 'create', async data => { entered(); await gate; return originalCreate(data) })
  const update = applicationRequest(created.data.id, { ...created.data, status: 'Offer' }, token)
  await started
  let deletionFinished = false
  const deletion = fetch(`${base}/api/auth/me`, { method: 'DELETE', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: password }) }).then(response => { deletionFinished = true; return response })
  try {
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(deletionFinished, false)
  } finally { release() }
  assert.equal((await update).response.status, 200)
  assert.equal((await deletion).status, 200)
  assert.equal(await Notification.countDocuments({ user: user.id }), 0)
  assert.equal(await User.findById(user.id), null)
})

test('secure account deletion cleans only own notifications and rejects stale JWT afterward', async () => {
  const own = await record(), foreign = await record(b)
  const response = await fetch(`${base}/api/auth/me`, { method: 'DELETE', headers: { ...auth(tokenA), 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: password }) })
  assert.equal(response.status, 200)
  assert.equal(await Notification.findById(own.id), null)
  assert.ok(await Notification.findById(foreign.id))
  assert.equal((await request()).status, 401)
  assert.equal((await request('/read-all', 'PATCH')).status, 401)
})
