import test from 'node:test'
import assert from 'node:assert/strict'
import * as service from '../src/services/applicationService.js'
import { installApi } from './apiMock.js'

test('service uses encoded resource IDs and safe errors for network, HTTP, and invalid JSON', async () => {
  globalThis.fetch = async url => { assert.ok(url.endsWith('/a%2Fb')); return new Response(JSON.stringify({ id: 'a/b', company: 'IFS' })) }
  assert.equal((await service.getApplication('a/b')).id, 'a/b')
  globalThis.fetch = async () => { throw new Error('secret connection string') }
  await assert.rejects(service.getApplications(), /Unable to reach/)
  for (const status of [400, 404, 500]) {
    globalThis.fetch = async () => new Response('secret stack trace', { status })
    await assert.rejects(service.createApplication({}), error => !error.message.includes('secret') && /try again|check/i.test(error.message))
  }
  globalThis.fetch = async () => new Response('invalid JSON')
  await assert.rejects(service.getApplications(), /invalid response/)
  globalThis.fetch = async () => new Response('{}')
  await assert.rejects(service.getApplications(), /invalid response/)
})

test('explicit legacy import resumes after partial failure, skips imported IDs, and completes once', async () => {
  const records = [{ id: 'one', company: 'IFS', position: 'Intern', status: 'Applied', documents: { resume: true } }, { id: 'two', company: 'WSO2', position: 'Intern', status: 'Saved' }]
  const browser = new Map([['interntrack_applications', JSON.stringify(records)]])
  globalThis.localStorage = { getItem: key => browser.get(key) ?? null, setItem: (key, value) => browser.set(key, value) }
  const server = new Map()
  installApi(server)
  const fetchApi = globalThis.fetch
  let posts = 0
  globalThis.fetch = async (...args) => {
    if (args[1]?.method === 'POST' && ++posts === 2) return new Response('{}', { status: 503 })
    return fetchApi(...args)
  }
  await assert.rejects(service.importLegacyApplications())
  assert.equal(browser.has('interntrack_api_import_complete'), false)
  globalThis.fetch = fetchApi
  await service.importLegacyApplications()
  const imported = await service.getApplications()
  assert.equal(imported.length, 2)
  assert.deepEqual(imported[0].documents, records[0].documents)
  assert.equal(browser.get('interntrack_api_import_complete'), 'true')
  assert.equal(browser.get('interntrack_applications'), JSON.stringify(records))
  await service.deleteApplication(imported[0].id)
  await service.importLegacyApplications()
  assert.equal((await service.getApplications()).length, 1)
})
