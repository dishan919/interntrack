import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saveApplicationNote, deleteApplicationNote } from '../src/services/applicationService.js'
import { getAccessToken, setAccessToken } from '../src/services/authSession.js'

test('note services encode IDs, send only text and existing Bearer authentication, and return confirmed application', async t => {
  const application = { id: 'app', company: 'IFS', applicationNotes: [{ id: 'note', text: 'Plain text' }] }
  let call
  t.mock.method(globalThis, 'fetch', async (url, options) => { call = { url, options }; return new Response(JSON.stringify(application)) })
  const saved = await saveApplicationNote('app/id', ' Plain text ', null, 'private-token')
  assert.deepEqual(saved.applicationNotes, application.applicationNotes)
  assert.equal(call.url, 'http://localhost:5000/api/applications/app%2Fid/notes')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), { text: ' Plain text ' })
  assert.equal(call.options.headers.Authorization, 'Bearer private-token')
  await saveApplicationNote('app', 'Edited', 'note/id', 'private-token')
  assert.equal(call.url, 'http://localhost:5000/api/applications/app/notes/note%2Fid')
  assert.equal(call.options.method, 'PATCH')
  await deleteApplicationNote('app', 'note/id', 'private-token')
  assert.equal(call.options.method, 'DELETE')
  assert.equal(call.options.body, undefined)
})

test('note failures remain safe and use existing session invalidation', async t => {
  const previousToken = getAccessToken()
  try {
    for (const status of [400, 404, 500]) {
      t.mock.method(globalThis, 'fetch', async () => new Response('private diagnostic', { status }))
      await assert.rejects(saveApplicationNote('app', 'x', null, 'token'), error => !error.message.includes('private diagnostic'))
    }
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('private connection string') })
    await assert.rejects(deleteApplicationNote('app', 'note', 'token'), /Unable to reach/)
    setAccessToken('current-token')
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }))
    await assert.rejects(saveApplicationNote('app', 'x', null, 'stale-token'), /session has expired/)
    assert.equal(getAccessToken(), 'current-token')
    await assert.rejects(saveApplicationNote('app', 'x', null, 'current-token'), /session has expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(previousToken) }
})
