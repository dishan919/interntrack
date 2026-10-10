import assert from 'node:assert/strict'
import test from 'node:test'
import { DOCUMENTS, getDocumentProgress, normalizeDocuments, updateApplicationDocument } from '../src/utils/documentUtils.js'
import { loadApplications, saveApplications } from '../src/services/applicationService.js'

test('legacy and malformed document data default to unchecked; only true means ready', () => {
  for (const value of [undefined, null, '', [], 12, false]) {
    assert.deepEqual(Object.values(normalizeDocuments(value)), [false, false, false, false])
    assert.equal(getDocumentProgress(value), '0 of 4 ready')
  }
  assert.equal(getDocumentProgress({ resume: true, coverLetter: 'true', portfolio: 1, transcript: true, extra: true }), '2 of 4 ready')
  assert.deepEqual(DOCUMENTS.map(([, label]) => label), ['Resume / CV', 'Cover Letter', 'Portfolio', 'Transcript'])
})

test('each checkbox updates current Context documents with only a documents patch', () => {
  let application = { id: 'one', company: 'IFS', status: 'Applied', notes: 'Keep this', documents: { portfolio: true } }
  const original = structuredClone(application)
  const updates = []
  const getApplication = id => id === application.id ? application : undefined
  const updateApplication = (id, patch) => {
    assert.equal(id, 'one')
    assert.deepEqual(Object.keys(patch), ['documents'])
    updates.push(patch)
    application = { ...application, ...patch }
  }
  for (const [key] of DOCUMENTS) {
    updateApplicationDocument('one', key, true, getApplication, updateApplication)
  }
  assert.equal(getDocumentProgress(application.documents), '4 of 4 ready')
  for (const [key] of DOCUMENTS) {
    assert.equal(updateApplicationDocument('one', key, false, getApplication, updateApplication), true)
  }
  assert.equal(getDocumentProgress(application.documents), '0 of 4 ready')
  assert.equal(application.notes, original.notes)
  assert.deepEqual(original.documents, { portfolio: true })
  const count = updates.length
  for (const [id, key, checked] of [['missing', 'resume', true], ['one', 'unknown', true], ['one', 'resume', 'true'], ['one', 'resume', false]]) {
    assert.equal(updateApplicationDocument(id, key, checked, getApplication, updateApplication), false)
  }
  assert.equal(updates.length, count)
})

test('legacy records are not rewritten; checklist changes persist and isolate applications', () => {
  const key = 'interntrack_applications'
  const original = JSON.stringify([
    { id: 'one', company: 'IFS', status: 'Applied', notes: 'Keep this' },
    { id: 'two', company: 'WSO2', status: 'Interview', documents: { transcript: true } },
  ])
  const storage = new Map([[key, original]])
  let writes = 0
  globalThis.localStorage = { getItem: name => storage.get(name) ?? null, setItem: (name, value) => { writes++; storage.set(name, value) } }
  let { applications, error } = loadApplications()
  assert.equal(error, '')
  assert.equal(writes, 0)
  assert.equal(storage.get(key), original)
  assert.equal(getDocumentProgress(applications[0].documents), '0 of 4 ready')
  const other = structuredClone(applications[1])
  const getApplication = id => applications.find(app => app.id === id)
  const updateApplication = (id, patch) => {
    applications = applications.map(app => app.id === id ? { ...app, ...patch } : app)
    assert.equal(saveApplications(applications), '')
  }
  updateApplicationDocument('one', 'resume', true, getApplication, updateApplication)
  updateApplicationDocument('one', 'coverLetter', true, getApplication, updateApplication)
  applications = loadApplications().applications
  assert.equal(getDocumentProgress(applications[0].documents), '2 of 4 ready')
  assert.equal(applications[0].notes, 'Keep this')
  assert.deepEqual(applications[1], other)
  updateApplicationDocument('one', 'resume', false, getApplication, updateApplication)
  assert.equal(getDocumentProgress(loadApplications().applications[0].documents), '1 of 4 ready')
})
