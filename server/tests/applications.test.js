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
let otherUserId
let otherAuthorization
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
  const other = await User.create({ name: 'Other User', email: 'other@example.com', password: 'TestPassword123' })
  otherUserId = other.id
  otherAuthorization = `Bearer ${createAccessToken(other.id, testSecret)}`
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
    const spies = ['find', 'findOne', 'create', 'exists', 'findOneAndReplace', 'findOneAndDelete'].map(name =>
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

test('two users list only their own applications and cannot read, replace, or delete each other?s records', async () => {
  const a = await create()
  const response = await request('POST', '', { ...valid, company: 'Company B' }, otherAuthorization)
  assert.equal(response.status, 201)
  const b = await response.json()
  for (const [authorization, own, foreign] of [[`Bearer ${accessToken}`, a, b], [otherAuthorization, b, a]]) {
    assert.deepEqual(await (await request('GET', '', undefined, authorization)).json(), [own])
    assert.deepEqual(await (await request('GET', `/${own.id}`, undefined, authorization)).json(), own)
    for (const method of ['GET', 'PUT', 'DELETE']) {
      for (const body of method === 'PUT' ? [valid, {}] : [undefined]) {
        const denied = await request(method, `/${foreign.id}?owner=${userId}&userId=${otherUserId}`, body, authorization)
        assert.equal(denied.status, 404)
        assert.deepEqual(await denied.json(), { message: 'Application not found' })
      }
    }
  }
  assert.deepEqual(await (await request()).json(), [a])
  assert.deepEqual(await (await request('GET', '', undefined, otherAuthorization)).json(), [b])
  assert.equal(await Application.countDocuments(), 2)
})

test('POST and PUT ignore client ownership fields and preserve the verified owner through replacement', async () => {
  for (const [authorization, owner, impostor] of [[`Bearer ${accessToken}`, userId, otherUserId], [otherAuthorization, otherUserId, userId]]) {
    const spoof = { owner: impostor, ownerId: impostor, userId: impostor }
    const response = await request('POST', `?owner=${impostor}&userId=${impostor}`, { ...valid, ...spoof }, authorization)
    assert.equal(response.status, 201)
    const created = await response.json()
    for (const fields of [spoof, { owner: null, ownerId: { $ne: null }, userId: 'invalid' }, {}]) {
      const updated = await request('PUT', `/${created.id}`, { ...valid, ...fields }, authorization)
      assert.equal(updated.status, 200)
      assert.deepEqual(await updated.json(), created)
      const stored = await Application.findById(created.id)
      assert.equal(stored.owner.toString(), owner)
      assert.equal(stored.ownerId, undefined)
      assert.equal(stored.userId, undefined)
      assert.equal(stored.owner._bsontype, 'ObjectId')
      for (const key of ['owner', 'ownerId', 'userId']) assert.equal(Object.hasOwn(created, key), false)
    }
  }
})

test('legacy ownerless records remain untouched and inaccessible to both users', async () => {
  const { insertedId } = await Application.collection.insertOne({ ...valid, status: 'Saved' })
  for (const authorization of [`Bearer ${accessToken}`, otherAuthorization]) {
    assert.deepEqual(await (await request('GET', '', undefined, authorization)).json(), [])
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await request(method, `/${insertedId}`, method === 'PUT' ? { ...valid, owner: userId } : undefined, authorization)
      assert.equal(response.status, 404)
      assert.deepEqual(await response.json(), { message: 'Application not found' })
    }
  }
  const legacy = await Application.collection.findOne({ _id: insertedId })
  assert.deepEqual(legacy, { _id: insertedId, ...valid, status: 'Saved' })
})

test('Application schema requires and indexes an ObjectId User reference', async () => {
  const owner = Application.schema.path('owner')
  assert.equal(owner.instance, 'ObjectId')
  assert.equal(owner.options.ref, 'User')
  assert.ok(Application.schema.indexes().some(([keys]) => keys.owner === 1))
  await assert.rejects(Application.create(valid), error => error.errors.owner.kind === 'required')
})


test('owner manages structured notes with trimmed text, server IDs/timestamps and persistent reads', async () => {
  const app = await create({ ...valid, notes: 'Earlier free-text note' })
  const response = await request('POST', `/${app.id}/notes`, { text: '  First note\n  ' })
  assert.equal(response.status, 201)
  let saved = await response.json()
  const note = saved.applicationNotes[0]
  assert.deepEqual(Object.keys(note).sort(), ['createdAt', 'id', 'text', 'updatedAt'])
  assert.match(note.id, /^[a-f0-9]{24}$/)
  assert.equal(note.text, 'First note')
  assert.ok(Number.isFinite(Date.parse(note.createdAt)))
  assert.ok(Number.isFinite(Date.parse(note.updatedAt)))
  assert.equal(saved.notes, 'Earlier free-text note')
  const edit = await request('PATCH', `/${app.id}/notes/${note.id}`, { text: ' Updated note ' })
  assert.equal(edit.status, 200)
  saved = await edit.json()
  assert.equal(saved.applicationNotes[0].text, 'Updated note')
  assert.equal(saved.applicationNotes[0].createdAt, note.createdAt)
  assert.ok(Date.parse(saved.applicationNotes[0].updatedAt) >= Date.parse(note.updatedAt))
  assert.deepEqual((await (await request('GET', `/${app.id}`)).json()).applicationNotes, saved.applicationNotes)
  const ordinaryEdit = await request('PUT', `/${app.id}`, { ...valid, notes: 'Legacy changed', applicationNotes: [], 'applicationNotes.0.text': 'forged' })
  assert.equal(ordinaryEdit.status, 200)
  assert.deepEqual((await ordinaryEdit.json()).applicationNotes, saved.applicationNotes)
  const deleted = await request('DELETE', `/${app.id}/notes/${note.id}`)
  assert.equal(deleted.status, 200)
  assert.deepEqual((await deleted.json()).applicationNotes, [])
  assert.equal((await request('DELETE', `/${app.id}/notes/${note.id}`)).status, 404)
})

test('note validation rejects malformed, empty, oversized and arbitrary metadata without writes', async () => {
  const app = await create({ ...valid, applicationNotes: [{ text: 'forged', owner: otherUserId }] })
  assert.equal(app.applicationNotes, undefined)
  const added = await request('POST', `/${app.id}/notes`, { text: 'x'.repeat(2000) })
  assert.equal(added.status, 201)
  const note = (await added.json()).applicationNotes[0]
  for (const body of [{}, { text: '' }, { text: ' \n\t ' }, { text: 12 }, { text: {} }, { text: 'x'.repeat(2001) }, [], null, { text: 'x', owner: otherUserId }, { text: 'x', userId }, { text: 'x', id: note.id }, { text: 'x', createdAt: '2000-01-01' }, { text: 'x', extra: true }]) {
    for (const [method, path] of [['POST', `/${app.id}/notes`], ['PATCH', `/${app.id}/notes/${note.id}`]]) {
      assert.equal((await request(method, path, body)).status, 400)
    }
  }
  const stored = await Application.findById(app.id)
  assert.equal(stored.applicationNotes.length, 1)
  assert.equal(stored.applicationNotes[0].text, 'x'.repeat(2000))
  assert.throws(() => stored.applicationNotes.push({ text: 'x', owner: userId }))
})

test('notes require JWT and existing account; other users cannot read or mutate private notes', async () => {
  const app = await create()
  const note = (await (await request('POST', `/${app.id}/notes`, { text: 'Private' })).json()).applicationNotes[0]
  for (const [method, path, body] of [['POST', `/${app.id}/notes`, { text: 'stolen', owner: userId }], ['PATCH', `/${app.id}/notes/${note.id}`, { text: 'stolen', userId }], ['DELETE', `/${app.id}/notes/${note.id}`]]) {
    for (const auth of [null, 'Bearer invalid', `Bearer ${jwt.sign({ sub: userId }, testSecret, { expiresIn: -1 })}`, `Bearer ${createAccessToken('0123456789abcdef01234567', testSecret)}`]) {
      assert.equal((await request(method, path, body, auth)).status, 401)
    }
    const response = await request(method, path, body, otherAuthorization)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { message: 'Application or note not found' })
  }
  assert.equal((await request('GET', `/${app.id}`, undefined, otherAuthorization)).status, 404)
  assert.deepEqual(await (await request('GET', '', undefined, otherAuthorization)).json(), [])
  assert.equal((await Application.findById(app.id)).applicationNotes[0].text, 'Private')
})

test('note IDs and application IDs fail safely, and notes cannot be addressed through another application', async () => {
  const app = await create()
  const other = await create()
  const note = (await (await request('POST', `/${app.id}/notes`, { text: 'Private' })).json()).applicationNotes[0]
  for (const appId of ['bad-id', '0123456789abcdef01234567']) {
    assert.equal((await request('POST', `/${appId}/notes`, { text: 'x' })).status, 404)
    assert.equal((await request('PATCH', `/${appId}/notes/${note.id}`, { text: 'x' })).status, 404)
    assert.equal((await request('DELETE', `/${appId}/notes/${note.id}`)).status, 404)
  }
  for (const noteId of ['bad-id', '0123456789abcdef01234567', note.id]) {
    for (const method of ['PATCH', 'DELETE']) {
      const response = await request(method, `/${other.id}/notes/${noteId}`, { text: 'x' })
      assert.equal(response.status, 404)
      assert.deepEqual(await response.json(), { message: 'Application or note not found' })
    }
  }
})

test('concurrent note additions and ordinary edits preserve notes and deletion removes them with the application', async () => {
  const app = await create()
  const results = await Promise.all([
    request('POST', `/${app.id}/notes`, { text: 'One' }),
    request('POST', `/${app.id}/notes`, { text: 'Two' }),
    request('PUT', `/${app.id}`, { ...valid, company: 'Updated' }),
  ])
  assert.deepEqual(results.map(result => result.status), [201, 201, 200])
  assert.equal((await (await request('GET', `/${app.id}`)).json()).applicationNotes.length, 2)
  assert.equal((await request('DELETE', `/${app.id}`)).status, 204)
  assert.equal((await request('POST', `/${app.id}/notes`, { text: 'x' })).status, 404)
})
