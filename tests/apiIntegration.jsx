import assert from 'node:assert/strict'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AuthFixture from './authFixture'
import ApplicationProvider from '../src/context/ApplicationProvider'
import { useApplications } from '../src/context/ApplicationContext'
import Layout from '../src/components/layout/Layout'
import Dashboard from '../src/pages/Dashboard'
import { installApi } from './apiMock'

export default async function verifyApiIntegration() {
  const server = new Map()
  const calls = installApi(server)
  const rest = globalThis.fetch
  let resolveLoad
  globalThis.fetch = url => url.endsWith('/notifications') ? Promise.resolve(new Response('{"notifications":[],"unreadCount":0}')) : new Promise(resolve => { resolveLoad = resolve })
  let context
  function Capture() { const value = useApplications(); useEffect(() => { context = value }); return null }
  const container = document.createElement('div')
  const root = createRoot(container)
  async function mount() {
    await act(async () => root.render(<MemoryRouter><AuthFixture><ApplicationProvider><Capture /><Routes><Route element={<Layout />}><Route index element={<Dashboard />} /></Route></Routes></ApplicationProvider></AuthFixture></MemoryRouter>))
  }
  try {
    await mount()
    assert.equal(context.loading, true)
    assert.match(container.textContent, /Loading applications/)
    assert.doesNotMatch(container.textContent, /No applications|Your overview/)
    await act(async () => resolveLoad(new Response('[]')))
    assert.equal(context.loading, false)
    assert.equal(context.loaded, true)
    globalThis.fetch = rest
    let added
    await act(async () => { added = await context.addApplication({ company: 'IFS', position: 'Intern', status: 'Applied', documents: { resume: true }, custom: { keep: true } }) })
    assert.ok(added.id)
    assert.deepEqual(context.applications, [added])
    await act(async () => {
      await Promise.all([context.updateApplication(added.id, { status: 'Interview' }), context.updateApplication(added.id, { notes: 'Updated' })])
    })
    assert.equal(context.getApplication(added.id).status, 'Interview')
    assert.equal(context.getApplication(added.id).notes, 'Updated')
    assert.equal(context.getApplication(added.id).activity.length, 2)
    await act(async () => { await context.reloadApplications() })
    assert.equal(context.getApplication(added.id).status, 'Interview')
    const before = structuredClone(context.applications)
    globalThis.fetch = async () => new Response('sensitive stack', { status: 500 })
    await act(async () => { assert.equal(await context.updateApplication(added.id, { status: 'Offer' }), null) })
    assert.deepEqual(context.applications, before)
    await act(async () => { assert.equal(await context.addApplication({ company: 'Failed', position: 'Intern' }), null) })
    assert.deepEqual(context.applications, before)
    assert.match(container.textContent, /Unable to save or load/)
    assert.doesNotMatch(container.textContent, /sensitive stack/)
    await act(async () => { assert.equal(await context.deleteApplication(added.id), null) })
    assert.deepEqual(context.applications, before)
    await act(async () => { await context.reloadApplications() })
    assert.match(container.textContent, /Unable to load applications/)
    assert.equal(context.loading, false)
    globalThis.fetch = rest
    await act(async () => { await context.reloadApplications(); await context.deleteApplication(added.id); await context.reloadApplications() })
    assert.deepEqual(context.applications, [])
    assert.ok(calls.some(call => call.method === 'POST'))
    assert.ok(calls.some(call => call.method === 'PUT'))
    assert.ok(calls.some(call => call.method === 'DELETE'))
  } finally { await act(async () => root.unmount()); globalThis.fetch = rest }

  // Initial outage must show retry feedback instead of false empty data.
  globalThis.fetch = async () => { throw new Error('offline') }
  const offlineContainer = document.createElement('div')
  const offlineRoot = createRoot(offlineContainer)
  try {
    await act(async () => offlineRoot.render(<MemoryRouter><AuthFixture><ApplicationProvider><Routes><Route element={<Layout />}><Route index element={<Dashboard />} /></Route></Routes></ApplicationProvider></AuthFixture></MemoryRouter>))
    assert.match(offlineContainer.textContent, /Unable to load applications/)
    assert.doesNotMatch(offlineContainer.textContent, /No applications/)
    globalThis.fetch = rest
    await act(async () => offlineContainer.querySelector('main button').click())
    assert.doesNotMatch(offlineContainer.textContent, /Unable to load applications/)
  } finally { await act(async () => offlineRoot.unmount()); globalThis.fetch = rest }
  return 'PASS: initial loading, retry after outage, API CRUD, queued updates, confirmed state, safe errors, failed writes and refresh persistence'
}
