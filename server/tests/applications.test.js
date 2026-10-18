import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import app from '../src/app.js'
import jwt from 'jsonwebtoken'
import User from '../src/models/User.js'
import { createAccessToken } from '../src/config/jwt.js'
import Application from '../src/models/Application.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'

let server
let baseUrl
let database
let accessToken
let userId
const testSecret = 'feature04-disposable-test-secret'
const originalSecret = process.env.JWT_SECRET
const valid = { company: 'IFS', position: 'Software Engineer Intern' }

before(async () => {
  process.env.JWT_SECRET = testSecret
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  const user = await User.create({ name: 'Test User', email: 'feature04@example.com', password: 'TestPassword123' })
  userId = user.id
  accessToken = createAccessToken(userId, testSecret)
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}/api/applications`
})

// Only this disposable database is cleared; tests never connect to personal data.
beforeEach(async () => { await Application.deleteMany({}) })
after(async () => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
  if (server) await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
  await disconnectDatabase()
  if (database) await database.stop()
})

function request(method = 'GET', path = '', body, authorization = `Bearer ${accessToken}`) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(authorization === null ? {} : { Authorization: authorization }) },
    ...(body === undefined ? {} : {
      body: JSON.stringify(body),
    }),
  })
}

async function create(body = valid) {
  const response = await request('POST', '', body)
  assert.equal(response.status, 201)
  return response.json()
}

test('GET returns 200 and an empty array', async () => {
  const response = await request()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), [])
})

test('POST creates unique server IDs, trims required fields, and defaults status', async () => {
  const response = await request('POST', '', { company: ' IFS ', position: ' Intern ', id: 'client-id', _id: '000000000000000000000001', __v: 99 })
  assert.equal(response.status, 201)
  const created = await response.json()
  assert.match(created.id, /^[0-9a-f]{24}$/)
  assert.notEqual(created.id, 'client-id')
  assert.notEqual(created.id, '000000000000000000000001')
  assert.equal(await Application.countDocuments({ _id: created.id }), 1)
  assert.deepEqual(created, { company: 'IFS', position: 'Intern', id: created.id, status: 'Saved' })
  assert.equal(response.headers.get('location'), `/api/applications/${created.id}`)
  const second = await create()
  assert.notEqual(second.id, created.id)
  const list = await request()
  assert.deepEqual(await list.json(), [created, second])
  const single = await request('GET', `/${created.id}`)
  assert.equal(single.status, 200)
  assert.deepEqual(await single.json(), created)
})

const invalidBodies = [
  ['missing company', { position: 'Intern' }],
  ['missing position', { company: 'IFS' }],
  ['blank company', { ...valid, company: '  ' }],
  ['blank position', { ...valid, position: '\t ' }],
  ['non-string company', { ...valid, company: 42 }],
  ['non-string position', { ...valid, position: {} }],
  ['invalid status', { ...valid, status: 'Hired' }],
  ['null status', { ...valid, status: null }],
  ['array body', []],
  ['null body', null],
]

for (const method of ['POST', 'PUT']) {
  for (const [label, body] of invalidBodies) {
    test(`${method} rejects ${label} without changing records`, async () => {
      const existing = await create()
      const response = await request(method, method === 'PUT' ? `/${existing.id}` : '', body)
      assert.equal(response.status, 400)
      assert.equal(typeof (await response.json()).message, 'string')
      assert.deepEqual(await (await request()).json(), [existing])
    })
  }
  test(`${method} rejects a missing JSON body`, async () => {
    const existing = await create()
    const response = await request(method, method === 'PUT' ? `/${existing.id}` : '')
    assert.equal(response.status, 400)
    assert.deepEqual(await (await request()).json(), [existing])
  })
}

for (const status of ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']) {
  test(`POST and PUT accept ${status}`, async () => {
    const created = await create({ ...valid, status })
    assert.equal(created.status, status)
    const updated = await request('PUT', `/${created.id}`, { ...valid, status })
    assert.equal(updated.status, 200)
    assert.equal((await updated.json()).status, status)
  })
}

test('POST and PUT retain supplied optional metadata; PUT replaces editable fields and preserves ID', async () => {
  const metadata = {
    location: 'Colombo', jobUrl: 'https://example.com', appliedDate: '2026-10-17',
    deadline: '2026-11-01', interviewDate: '2026-10-25', notes: 'Prepare',
    interview: { date: '2026-10-25', stage: 'Technical Interview', type: 'Online' },
    skills: { required: ['React'], matched: ['React'] }, documents: { resume: true },
    activity: [{ id: 'event', type: 'created', message: 'Application created', createdAt: '2026-10-17T00:00:00Z' }],
    followUp: { date: '2026-10-20', note: 'Email recruiter', completed: false },
    createdAt: '2026-10-17T00:00:00Z', customField: { nested: ['keep'], empty: {} },
  }
  const created = await create({ ...valid, ...metadata, status: 'Applied', removedOnPut: true })
  assert.deepEqual(created, { ...valid, ...metadata, status: 'Applied', removedOnPut: true, id: created.id })
  const body = { ...valid, ...metadata, company: ' WSO2 ', status: 'Interview', id: 'override', _id: '000000000000000000000001', __v: 99 }
  const response = await request('PUT', `/${created.id}`, body)
  assert.equal(response.status, 200)
  const updated = await response.json()
  assert.deepEqual(updated, { ...valid, ...metadata, company: 'WSO2', status: 'Interview', id: created.id })
  const raw = await Application.collection.findOne({ _id: (await Application.findById(created.id))._id })
  assert.deepEqual(raw.interview, metadata.interview)
  assert.deepEqual(raw.skills, metadata.skills)
  assert.deepEqual(raw.documents, metadata.documents)
  assert.deepEqual(raw.activity, metadata.activity)
  assert.deepEqual(raw.followUp, metadata.followUp)
  assert.deepEqual(await (await request('GET', `/${created.id}`)).json(), updated)
  const replacement = await request('PUT', `/${created.id}`, valid)
  assert.equal(replacement.status, 200)
  assert.deepEqual(await replacement.json(), { ...valid, status: 'Saved', id: created.id })
})

for (const method of ['GET', 'PUT', 'DELETE']) {
  test(`${method} valid but nonexistent MongoDB ID returns 404`, async () => {
    const response = await request(method, '/000000000000000000000001', method === 'PUT' ? valid : undefined)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { message: 'Application not found' })
  })
  test(`${method} unknown ID returns application-specific 404 without creating records`, async () => {
    const response = await request(method, '/not-an-id', method === 'PUT' ? valid : undefined)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { message: 'Application not found' })
    assert.deepEqual(await (await request()).json(), [])
  })
}

test('DELETE returns empty 204, removes only the target, and subsequent reads/deletes return 404', async () => {
  const created = await create()
  const other = await create({ ...valid, company: 'Other' })
  const response = await request('DELETE', `/${created.id}`)
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.deepEqual(await (await request()).json(), [other])
  for (const method of ['GET', 'DELETE']) {
    const missing = await request(method, `/${created.id}`)
    assert.equal(missing.status, 404)
    assert.deepEqual(await missing.json(), { message: 'Application not found' })
  }
})

// The frontend service crosses the real Express/Mongoose boundary using a disposable database.
test('frontend REST service preserves nested metadata through MongoDB and status refreshes', async () => {
  const service = await import('../../src/services/applicationService.js')
  const originalFetch = globalThis.fetch
  // Test-only authentication transport; production frontend remains unchanged.
  globalThis.fetch = (url, options) => originalFetch(url.replace('http://localhost:5000/api/applications', baseUrl), { ...options, headers: { ...options?.headers, Authorization: `Bearer ${accessToken}` } })
  try {
    const data = { ...valid, status: 'Applied', deadline: '2026-10-25', interview: { date: '2026-10-20', time: '10:30', notes: 'Prepare React' }, skills: { required: ['React'], matched: ['React'] }, documents: { resume: true, custom: { keep: true } }, activity: [{ id: 'event', type: 'created', message: 'Created', createdAt: '2026-10-01T09:00:00Z' }], followUp: { date: '2026-10-22', completed: false, note: 'Email HR' }, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-02T09:00:00Z', custom: { nested: [null, { keep: true }] } }
    const created = await service.createApplication(data)
    const saved = await service.updateApplication(created.id, { ...created, status: 'Interview' })
    const reloaded = await service.getApplication(created.id)
    assert.deepEqual(reloaded, saved)
    for (const key of Object.keys(data).filter(key => key !== 'status')) assert.deepEqual(reloaded[key], data[key])
    assert.equal(reloaded.status, 'Interview')
    assert.equal((await service.getApplications()).length, 1)
    await service.deleteApplication(created.id)
    assert.deepEqual(await service.getApplications(), [])
  } finally { globalThis.fetch = originalFetch }
})

// With valid bodies and IDs, every controller reaches one of these model operations.
// Spies prove failed authentication stops before that controller work.
for (const [method, path] of [['GET', ''], ['GET', '/0123456789abcdef01234567'], ['POST', ''], ['PUT', '/0123456789abcdef01234567'], ['DELETE', '/0123456789abcdef01234567']]) {
  test(`${method} ${path || '/'} rejects failed authentication before controller work`, async t => {
    const spies = ['find', 'findById', 'create', 'exists', 'findOneAndReplace', 'findByIdAndDelete'].map(name =>
      t.mock.method(Application, name, () => { throw new Error('Controller reached') }))
    const expired = jwt.sign({}, testSecret, { subject: userId, expiresIn: -1 })
    for (const authorization of [null, 'Bearer', 'Basic abc', 'Bearer abc def', 'Bearer invalid', `Bearer ${expired}`]) {
      const response = await request(method, path, ['POST', 'PUT'].includes(method) ? valid : undefined, authorization)
      assert.equal(response.status, 401)
      assert.deepEqual(await response.json(), { message: 'Unauthorized' })
    }
    for (const spy of spies) assert.equal(spy.mock.callCount(), 0)
  })
}

test('query tokens and client identity cannot replace a verified Bearer token', async () => {
  const response = await request('POST', `?accessToken=${accessToken}&userId=${userId}`, { ...valid, userId }, null)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { message: 'Unauthorized' })
  assert.equal(await Application.countDocuments(), 0)
})

test('authenticated users intentionally share applications until ownership is implemented', async () => {
  const created = await create()
  const other = await User.create({ name: 'Other User', email: 'other@example.com', password: 'TestPassword123' })
  const token = createAccessToken(other.id, testSecret)
  const response = await request('GET', `/${created.id}`, undefined, `Bearer ${token}`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), created)
  assert.equal(Object.hasOwn(created, 'userId'), false)
  assert.equal(Object.hasOwn(created, 'ownerId'), false)
})
