import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { ApplicationContext } from './ApplicationContext'
import * as service from '../services/applicationService'
import { applyApplicationUpdate, createApplication } from '../utils/activityUtils'
export default function ApplicationProvider({ children }) {
  const { user, accessToken, isAuthenticated, isAuthLoading } = useAuth()
  if (isAuthLoading || !isAuthenticated) return null
  return <UserApplications key={`${user.id}:${accessToken}`} token={accessToken}>{children}</UserApplications>
}

function UserApplications({ children, token }) {
  const active = useRef(true)
  const [applications, setApplications] = useState([])
  const current = useRef([])
  const queue = useRef(Promise.resolve())
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(0)
  function commit(next) { if (active.current) { current.current = next; setApplications(next) } }
  async function reloadApplications() {
    if (!active.current) return
    setLoading(true)
    setError('')
    try { commit(await service.getApplications(token)); if (active.current) setLoaded(true) }
    catch { if (active.current) setError('Unable to load applications. Please try again.') }
    finally { if (active.current) setLoading(false) }
  }
  useEffect(() => {
    active.current = true
    service.getApplications(token).then(data => {
      if (active.current) { commit(data); setLoaded(true); setError(''); setLoading(false) }
    }).catch(() => { if (active.current) { setError('Unable to load applications. Please try again.'); setLoading(false) } })
    return () => { active.current = false; current.current = [] }
  }, [token])
  // Serialize writes and read the latest server-confirmed record when each starts.
  // This prevents rapid checkbox/status updates from overwriting each other's metadata.
  function mutate(operation) {
    setPending(count => count + 1)
    const result = queue.current.then(async () => {
      if (!active.current) return null
      setError('')
      try { const value = await operation(); return active.current ? value : null }
      catch (failure) { if (active.current) setError(failure.message); return null }
      finally { if (active.current) setPending(count => count - 1) }
    })
    queue.current = result
    return result
  }
  function addApplication(values) {
    return mutate(async () => {
      const saved = await service.createApplication(createApplication(values), token)
      commit([saved, ...current.current])
      return saved
    })
  }
  function updateApplication(id, values) {
    return mutate(async () => {
      const application = current.current.find(app => app.id === id)
      if (!application) throw new Error('Application not found. Please reload applications.')
      const saved = await service.updateApplication(id, applyApplicationUpdate(application, values), token)
      commit(current.current.map(app => app.id === id ? saved : app))
      return saved
    })
  }
  function deleteApplication(id) {
    return mutate(async () => {
      await service.deleteApplication(id, token)
      commit(current.current.filter(app => app.id !== id))
      return true
    })
  }
  function importLegacyApplications() {
    return mutate(async () => {
      await service.importLegacyApplications(token)
      commit(await service.getApplications(token))
      return true
    })
  }
  function clearApplications() {
    return mutate(async () => {
      for (const app of [...current.current]) {
        if (!active.current) return null
        await service.deleteApplication(app.id, token)
        commit(current.current.filter(item => item.id !== app.id))
      }
      return true
    })
  }
  return <ApplicationContext.Provider value={{ applications, loading, loaded, error, pending: pending > 0, reloadApplications, importLegacyApplications, addApplication, updateApplication, deleteApplication, getApplication: id => current.current.find(app => app.id === id), clearApplications }}>{children}</ApplicationContext.Provider>
}
