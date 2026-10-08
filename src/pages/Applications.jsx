import KanbanBoard from '../components/applications/KanbanBoard'
import ViewSwitcher from '../components/applications/ViewSwitcher'
import { loadApplicationView, saveApplicationView } from '../services/viewPreferenceService'
import { sortByDeadline } from '../utils/deadlineUtils'
import useDeadlineToday from '../utils/useDeadlineToday'
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
  const [view, setView] = useState(loadApplicationView)
  const [viewError, setViewError] = useState('')
  function changeView(nextView) { setView(nextView); setViewError(saveApplicationView(nextView)) }
  const today = useDeadlineToday()
  const [sort, setSort] = useState('default')
  const [status, setStatus] = useState('')
  const filtered = applications.filter(app => (app.company + ' ' + app.position).toLowerCase().includes(search.toLowerCase()) && (!status || app.status === status))
  const sorted = sortByDeadline(filtered, sort)
  function remove(app) { if (window.confirm('Delete ' + app.position + ' at ' + app.company + '? This cannot be undone.')) deleteApplication(app.id) }
  return <><div className="page-heading"><div><div className="eyebrow">YOUR OPPORTUNITY COLLECTION</div><h1>Applications</h1><p>Every possibility deserves a place. Keep yours organized.</p></div><Link className="button primary" to="/applications/new">+ Add application</Link></div><section className="panel"><div className="applications-viewbar"><ViewSwitcher view={view} onChange={changeView} />{view === 'board' && <span className="board-hint">Scroll to see all statuses</span>}</div>{viewError && <div className="view-preference-notice" role="status">{viewError}</div>}<div className="toolbar"><SearchBar value={search} onChange={setSearch} /><FilterBar value={status} onChange={setStatus} /><select aria-label="Sort applications" value={sort} onChange={event => setSort(event.target.value)}><option value="default">Default order</option><option value="soonest">Deadline: Soonest</option><option value="latest">Deadline: Latest</option></select><span className="result-count">{filtered.length} of {applications.length} applications</span></div>{view === 'board' ? <>{!filtered.length && <EmptyState title={applications.length ? 'No matching applications' : undefined} message={applications.length ? 'Try a different search or status filter.' : undefined} action={!applications.length} />}<KanbanBoard applications={sorted} today={today} /></> : filtered.length ? sorted.map(app => <ApplicationCard key={app.id} application={app} today={today} onDelete={remove} />) : <EmptyState title={applications.length ? 'No matching applications' : undefined} message={applications.length ? 'Try a different search or status filter.' : undefined} action={!applications.length} />}</section></>
}
