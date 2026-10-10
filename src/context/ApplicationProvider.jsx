import { useState } from 'react'
import { ApplicationContext } from './ApplicationContext'
import { loadApplications, saveApplications } from '../services/applicationService'
import { applyApplicationUpdate, createApplication } from '../utils/activityUtils'
export default function ApplicationProvider({ children }) {
  const [initial] = useState(loadApplications)
  const [applications, setApplications] = useState(initial.applications)
  const [storageError, setStorageError] = useState(initial.error)
  // Save before updating React state, so every mutation uses the same path.
  function commit(next) {
    setStorageError(saveApplications(next))
    setApplications(next)
  }
  function addApplication(values) {
    commit([createApplication(values), ...applications])
  }
  function updateApplication(id, values) {
    commit(applications.map(app => app.id === id ? applyApplicationUpdate(app, values) : app))
  }
  function deleteApplication(id) { commit(applications.filter(app => app.id !== id)) }
  function getApplication(id) { return applications.find(app => app.id === id) }
  return <ApplicationContext.Provider value={{ applications, storageError, addApplication, updateApplication, deleteApplication, getApplication, clearApplications: () => commit([]) }}>{children}</ApplicationContext.Provider>
}
