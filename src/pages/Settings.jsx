import { useState } from 'react'
import { useApplications } from '../context/ApplicationContext'
import { exportApplicationData } from '../utils/exportData'
export default function Settings() {
  const { applications, clearApplications } = useApplications()
  const [message, setMessage] = useState('')
  function exportData() {
    exportApplicationData(applications)
    setMessage('Your application backup has been downloaded.')
  }
  function clear() {
    if (window.confirm('Permanently delete all ' + applications.length + ' applications from this device? Export a backup first.')) { clearApplications(); setMessage('All applications have been cleared.') }
  }
  return <><div className="page-heading"><div><div className="eyebrow">MAKE SPACE FOR YOUR NEXT CHAPTER</div><h1>Settings</h1><p>Manage your workspace and application data.</p></div></div>{message && <div className="notice" role="status">{message}</div>}<section className="panel settings-panel"><div className="panel-heading"><h2>Your data</h2></div><div className="setting-row"><div><h3>Stored on this device</h3><p>Your {applications.length} applications are stored in this browser�s localStorage. They remain after refresh. Clearing browser data removes them; other browsers and devices have their own workspace.</p></div><span className="count-pill">Local storage</span></div><div className="setting-row"><div><h3>Export a backup</h3><p>Download your applications as a JSON file to keep a personal copy.</p></div><button className="button secondary" onClick={exportData}>Export data ?</button></div><div className="setting-row"><div><h3 className="text-danger">Clear all applications</h3><p>Remove every application from this browser. This cannot be undone.</p></div><button className="button danger" disabled={!applications.length} onClick={clear}>Clear all data</button></div></section><div className="about-note"><strong>InternTrack</strong><p>A simple, personal space for your internship and job search. No account required.</p></div></>
}
