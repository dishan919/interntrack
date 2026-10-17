import { useEffect, useRef, useState } from 'react'
import { ApplicationContext } from './ApplicationContext'
import * as service from '../services/applicationService'
import { applyApplicationUpdate, createApplication } from '../utils/activityUtils'
export default function ApplicationProvider({ children }) {
  const [applications, setApplications] = useState([])
  const current = useRef([])
  const queue = useRef(Promise.resolve())
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(0)
  function commit(next) { current.current = next; setApplications(next) }
  async function reloadApplications() {
    setLoading(true)
    setError('')
    try { commit(await service.getApplications()); setLoaded(true) }
    catch { setError('Unable to load applications. Please try again.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    service.getApplications().then(data => {
      if (active) { commit(data); setLoaded(true); setError(''); setLoading(false) }
    }).catch(() => { if (active) { setError('Unable to load applications. Please try again.'); setLoading(false) } })
    return () => { active = false }
  }, [])
  // Serialize writes and read the latest server-confirmed record when each starts.
  // This prevents rapid checkbox/status updates from overwriting each other's metadata.
  function mutate(operation) {
    setPending(count => count + 1)
    const result = queue.current.then(async () => {
      setError('')
      try { return await operation() }
      catch (failure) { setError(failure.message); return null }
      finally { setPending(count => count - 1) }
    })
    queue.current = result
    return result
  }
  function addApplication(values) {
    return mutate(async () => {
      const saved = await service.createApplication(createApplication(values))
      commit([saved, ...current.current])
      return saved
    })
  }
  function updateApplication(id, values) {
    return mutate(async () => {
      const application = current.current.find(app => app.id === id)
      if (!application) throw new Error('Application not found. Please reload applications.')
      const saved = await service.updateApplication(id, applyApplicationUpdate(application, values))
      commit(current.current.map(app => app.id === id ? saved : app))
      return saved
    })
  }
  function deleteApplication(id) {
    return mutate(async () => {
      await service.deleteApplication(id)
      commit(current.current.filter(app => app.id !== id))
      return true
    })
  }
  function importLegacyApplications() {
    return mutate(async () => {
      await service.importLegacyApplications()
      commit(await service.getApplications())
      return true
    })
  }
  function clearApplications() {
    return mutate(async () => {
      for (const app of [...current.current]) {
        await service.deleteApplication(app.id)
        commit(current.current.filter(item => item.id !== app.id))
      }
      return true
    })
  }
  return <ApplicationContext.Provider value={{ applications, loading, loaded, error, pending: pending > 0, reloadApplications, importLegacyApplications, addApplication, updateApplication, deleteApplication, getApplication: id => current.current.find(app => app.id === id), clearApplications }}>{children}</ApplicationContext.Provider>
}
