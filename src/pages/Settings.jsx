import PageHeader from '../components/common/PageHeader'
import { useState } from 'react'
import { useApplications } from '../context/ApplicationContext'
import { exportApplicationData } from '../utils/exportData'
export default function Settings() {
  const { applications, clearApplications, pending, importLegacyApplications } = useApplications()
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  async function importRecords() {
    if (!window.confirm('Import previous records from this browser into MongoDB?')) return
    setImporting(true)
    try { if (await importLegacyApplications()) setMessage('Browser records imported. The original backup is retained.') }
    catch (error) { setMessage(error.message) }
    finally { setImporting(false) }
  }
  function exportData() {
    exportApplicationData(applications)
    setMessage('Your application backup has been downloaded.')
  }
  async function clear() {
    if (window.confirm('Permanently delete all ' + applications.length + ' applications from the database? Export a backup first.')) { if (await clearApplications()) setMessage('All applications have been cleared.') }
  }
  return <><PageHeader title="Settings" eyebrow="MAKE SPACE FOR YOUR NEXT CHAPTER" description={"Manage your workspace and application data."}></PageHeader>{message && <div className="notice" role="status">{message}</div>}<section className="panel settings-panel"><div className="panel-heading"><h2>Your data</h2></div><div className="setting-row"><div><h3>Stored in MongoDB</h3><p>Your {applications.length} applications are saved through the API in MongoDB and remain after refresh.</p></div><span className="count-pill">MongoDB</span></div><div className="setting-row"><div><h3>Export a backup</h3><p>Download your applications as a JSON file to keep a personal copy.</p></div><button className="button secondary" onClick={exportData}>Export data ?</button></div><div className="setting-row"><div><h3 className="text-danger">Clear all applications</h3><p>Remove every application from the database. This cannot be undone.</p></div><button className="button danger" disabled={pending || !applications.length} onClick={clear}>Clear all data</button></div></section><section className="panel settings-panel"><h2>Previous browser records</h2><p>Import the old browser backup once. Existing imported IDs are skipped on retry. The original backup stays in this browser.</p><button className="button secondary" disabled={pending || importing} onClick={importRecords}>Import browser records</button></section><div className="about-note"><strong>InternTrack</strong><p>A simple, personal space for your internship and job search. Your own space to plan what comes next.</p></div></>
}
