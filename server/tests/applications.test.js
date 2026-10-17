import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { once } from 'node:events'
import app from '../src/app.js'
import Application from '../src/models/Application.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { startTestDatabase } from './helpers/database.js'

let server
let baseUrl
let database
const valid = { company: 'IFS', position: 'Software Engineer Intern' }

before(async () => {
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}/api/applications`
})

// Only this disposable database is cleared; tests never connect to personal data.
beforeEach(async () => { await Application.deleteMany({}) })
after(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
  await disconnectDatabase()
  if (database) await database.stop()
})

function request(method = 'GET', path = '', body) {
  return fetch(`${baseUrl}${path}`, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
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
