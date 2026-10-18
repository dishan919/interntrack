/* eslint-disable react-refresh/only-export-components -- Test harness exports lifecycle helpers. */
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import AuthFixture from './authFixture'
import RealProvider from '../src/context/ApplicationProvider'
import { ApplicationContext, useApplications } from '../src/context/ApplicationContext'
let renderer
let context
let active
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
export async function reloadContext() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  if (renderer) await act(async () => renderer.unmount())
  function Capture() { const value = useApplications(); useEffect(() => { context = value }); return null }
  await act(async () => { renderer = createRoot(document.createElement('div')); renderer.render(<AuthFixture><RealProvider><Capture /></RealProvider></AuthFixture>) })
  active = { ...context }
  const actions = {}
  for (const key of ['addApplication', 'updateApplication', 'deleteApplication', 'clearApplications', 'reloadApplications']) {
    actions[key] = async (...args) => {
      let result
      await act(async () => { result = await context[key](...args) })
      Object.assign(active, context, actions)
      return result
    }
  }
  Object.assign(active, actions)
  return active
}
export default function FixtureProvider({ children }) {
  return <AuthFixture><ApplicationContext.Provider value={active}>{children}</ApplicationContext.Provider></AuthFixture>
}
export async function cleanupContext() { if (renderer) await act(async () => renderer.unmount()); renderer = null }
