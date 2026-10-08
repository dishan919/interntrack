import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApplications } from '../context/ApplicationContext'
import SearchBar from '../components/common/SearchBar'
import FilterBar from '../components/common/FilterBar'
import EmptyState from '../components/common/EmptyState'
import ApplicationCard from '../components/applications/ApplicationCard'
export default function Applications() {
  const { applications, deleteApplication } = useApplications()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('company') || '')
  const [status, setStatus] = useState('')
  const filtered = applications.filter(app => (app.company + ' ' + app.position).toLowerCase().includes(search.toLowerCase()) && (!status || app.status === status))
  function remove(app) { if (window.confirm('Delete ' + app.position + ' at ' + app.company + '? This cannot be undone.')) deleteApplication(app.id) }
  return <><div className="page-heading"><div><div className="eyebrow">YOUR OPPORTUNITY COLLECTION</div><h1>Applications</h1><p>Every possibility deserves a place. Keep yours organized.</p></div><Link className="button primary" to="/applications/new">+ Add application</Link></div><section className="panel"><div className="toolbar"><SearchBar value={search} onChange={setSearch} /><FilterBar value={status} onChange={setStatus} /><span className="result-count">{filtered.length} of {applications.length} applications</span></div>{filtered.length ? filtered.map(app => <ApplicationCard key={app.id} application={app} onDelete={remove} />) : <EmptyState title={applications.length ? 'No matching applications' : undefined} message={applications.length ? 'Try a different search or status filter.' : undefined} action={!applications.length} />}</section></>
}
