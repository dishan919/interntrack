import assert from 'node:assert/strict'
import test from 'node:test'
import { moveApplicationStatus } from '../src/utils/kanbanUtils.js'

test('moves send only the new status through updateApplication', () => {
  for (const [from, to] of [['Applied', 'Interview'], ['Interview', 'Offer'], ['Interview', 'Rejected']]) {
    const app = { id: 'IFS', status: from, deadline: '2026-10-20', interview: { date: '2026-10-15', notes: 'Prepare React' }, notes: 'Keep these notes' }
    const before = JSON.stringify(app)
    const calls = []
    assert.equal(moveApplicationStatus('IFS', to, id => id === app.id ? app : undefined, (...args) => calls.push(args)), true)
    assert.deepEqual(calls, [['IFS', { status: to }]])
    assert.equal(JSON.stringify(app), before)
  }
})

test('same-column, invalid status, and missing-record moves are no-ops', () => {
  let writes = 0
  const get = id => id === 'IFS' ? { id, status: 'Interview' } : undefined
  const update = () => { writes++ }
  assert.equal(moveApplicationStatus('IFS', 'Interview', get, update), false)
  assert.equal(moveApplicationStatus('IFS', 'unknown', get, update), false)
  assert.equal(moveApplicationStatus('gone', 'Offer', get, update), false)
  assert.equal(writes, 0)
})

test('moves inspect current Context status rather than a stale card status', () => {
  let currentStatus = 'Applied'
  const get = () => ({ id: 'IFS', status: currentStatus })
  let writes = 0
  const update = (_id, change) => { currentStatus = change.status; writes++ }
  assert.equal(moveApplicationStatus('IFS', 'Interview', get, update), true)
  assert.equal(moveApplicationStatus('IFS', 'Interview', get, update), false)
  assert.equal(writes, 1)
})
