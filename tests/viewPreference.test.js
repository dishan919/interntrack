import assert from 'node:assert/strict'
import test from 'node:test'
import { loadApplicationView, saveApplicationView } from '../src/services/viewPreferenceService.js'

test('view defaults to List and ignores unknown preferences', () => {
  for (const value of [null, '', 'unknown', 'list']) {
    globalThis.localStorage = { getItem: () => value }
    assert.equal(loadApplicationView(), 'list')
  }
  globalThis.localStorage = { getItem: () => 'board' }
  assert.equal(loadApplicationView(), 'board')
})

test('view preference persists independently of application records', () => {
  const records = '[{"id":"APP001","company":"WSO2","status":"Applied"}]'
  const store = new Map([['interntrack_applications', records]])
  const writes = []
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => { writes.push(key); store.set(key, value) } }
  assert.equal(saveApplicationView('board'), '')
  assert.equal(loadApplicationView(), 'board')
  assert.equal(saveApplicationView('list'), '')
  assert.equal(loadApplicationView(), 'list')
  assert.equal(store.get('interntrack_applications'), records)
  assert.deepEqual(writes, ['interntrack_application_view', 'interntrack_application_view'])
  assert.ok(saveApplicationView('invalid'))
  assert.equal(writes.length, 2)
})

test('blocked storage falls back to List and reports preference save errors', () => {
  globalThis.localStorage = { getItem: () => { throw new Error('Blocked') }, setItem: () => { throw new Error('Blocked') } }
  assert.equal(loadApplicationView(), 'list')
  assert.ok(saveApplicationView('board'))
})
