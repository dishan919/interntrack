import assert from 'node:assert/strict'
import test from 'node:test'
import { DOCUMENTS, getDocumentProgress, normalizeDocuments, updateApplicationDocument } from '../src/utils/documentUtils.js'
import { getApplications, updateApplication as putApplication } from '../src/services/applicationService.js'
import { installApi } from './apiMock.js'

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

test('checklist patches survive API reloads, preserve unknown metadata, and isolate records', async () => {
  const records = [{ id: 'one', company: 'IFS', position: 'Intern', status: 'Applied', notes: 'Keep this', documents: { custom: { keep: true } } }, { id: 'two', company: 'WSO2', position: 'Intern', status: 'Interview', documents: { transcript: true } }]
  installApi(new Map([['interntrack_applications', JSON.stringify(records)]]))
  let applications = await getApplications()
  const other = structuredClone(applications[1])
  const get = id => applications.find(app => app.id === id)
  const update = async (id, patch) => {
    const saved = await putApplication(id, { ...get(id), ...patch })
    applications = applications.map(app => app.id === id ? saved : app)
    return saved
  }
  assert.equal(getDocumentProgress(get('one').documents), '0 of 4 ready')
  assert.equal(await updateApplicationDocument('one', 'resume', true, get, update), true)
  await updateApplicationDocument('one', 'coverLetter', true, get, update)
  applications = await getApplications()
  assert.equal(getDocumentProgress(get('one').documents), '2 of 4 ready')
  assert.equal(get('one').notes, 'Keep this')
  assert.deepEqual(get('one').documents.custom, { keep: true })
  assert.deepEqual(get('two'), other)
  await updateApplicationDocument('one', 'resume', false, get, update)
  assert.equal(getDocumentProgress((await getApplications())[0].documents), '1 of 4 ready')
})