import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEventPublisher } from '../src/services/domainEvents.js'

test('publisher routes explicit events, supports multiple async subscribers and unsubscribe', async () => {
  const events = createEventPublisher()
  const calls = []
  const remove = events.subscribe('saved', async payload => { await Promise.resolve(); calls.push(['first', payload]) })
  events.subscribe('other', () => calls.push('wrong'))
  events.subscribe('saved', payload => calls.push(['second', payload]))
  await events.publish('saved', { applicationId: 'one' })
  assert.deepEqual(calls, [['first', { applicationId: 'one' }], ['second', { applicationId: 'one' }]])
  remove()
  await events.publish('saved', { applicationId: 'two' })
  assert.deepEqual(calls.at(-1), ['second', { applicationId: 'two' }])
  assert.equal(calls.length, 3)
  await events.publish('unknown', {})
  assert.equal(calls.length, 3)
})

test('synchronous and async observer failures are contained and later subscribers still run', async t => {
  const events = createEventPublisher()
  const warnings = []
  t.mock.method(console, 'warn', message => warnings.push(message))
  events.subscribe('saved', () => { throw new Error('private diagnostic') })
  events.subscribe('saved', async () => { throw new Error('private path') })
  let handled = false
  events.subscribe('saved', () => { handled = true })
  await events.publish('saved', {})
  assert.equal(handled, true)
  assert.deepEqual(warnings, ['Domain event observer failed.', 'Domain event observer failed.'])
})
