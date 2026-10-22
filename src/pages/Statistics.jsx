import PageHeader from '../components/common/PageHeader'
import { useApplications } from '../context/ApplicationContext'
import StatCard from '../components/common/StatCard'
import { countStatuses, STATUSES } from '../utils/applications'
export default function Statistics() {
  const { applications } = useApplications()
  const counts = countStatuses(applications)
  return <><PageHeader title="Statistics" eyebrow="SEE HOW FAR YOU'VE COME" description={"A simple snapshot of your application journey."}></PageHeader><div className="stats-grid"><StatCard label="Total applications" value={applications.length} icon="applications" /><StatCard label="Applied" value={counts.Applied} icon="arrow" tone="blue" /><StatCard label="Interviews" value={counts.Interview} icon="calendar" tone="purple" /><StatCard label="Offers" value={counts.Offer} icon="check" tone="green" /><StatCard label="Rejected" value={counts.Rejected} icon="close" tone="rose" /></div><section className="panel statistics-panel"><div className="panel-heading"><div><h2>Application breakdown</h2><p>Current status of all your tracked opportunities.</p></div></div><div className="chart">{STATUSES.map(status => <div className="chart-row" key={status}><span>{status}</span><div className="bar-track"><div className={'bar-fill bar-' + status.toLowerCase()} style={{ width: (applications.length ? counts[status] / applications.length * 100 : 0) + '%' }} /></div><strong>{counts[status]}</strong><small>{applications.length ? Math.round(counts[status] / applications.length * 100) : 0}%</small></div>)}</div><p className="chart-note">These counts show current statuses, rather than your full status history.</p></section></>
}
