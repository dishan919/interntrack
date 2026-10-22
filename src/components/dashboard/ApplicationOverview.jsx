import { Link } from 'react-router-dom'
import { STATUSES } from '../../utils/applications'
export default function ApplicationOverview({ counts, total }) {
  let offset = 0
  const segments = STATUSES.filter(status => counts[status]).map(status => {
    const from = offset
    offset += counts[status] / total * 100
    const color = { Saved: '--muted', Applied: '--color-info', Interview: '--color-interview', Offer: '--color-success', Rejected: '--color-danger' }[status]
    return `var(${color}) ${from}% ${offset}%`
  })
  return <section className="panel dashboard-overview" aria-labelledby="dashboard-overview-title">
    <div className="panel-heading"><div><h2 id="dashboard-overview-title">Application statistics</h2><p>Your pipeline at a glance.</p></div><Link className="subtle-link" to="/statistics">View report</Link></div>
    <div className="dashboard-overview-content"><div className="pipeline-donut" style={{ background: total ? `conic-gradient(${segments.join(', ')})` : 'var(--surface-muted)' }} role="img" aria-label={`${total} total applications, breakdown listed below`}><div><strong>{total}</strong><span>Applications</span></div></div>
      <ul className="dashboard-status-legend">{STATUSES.map(status => <li key={status}><span className={'dashboard-status-dot status-' + status.toLowerCase()} aria-hidden="true" /><span>{status}</span><strong>{counts[status]}</strong></li>)}</ul>
      {!total && <p className="dashboard-overview-empty">Add your first application to see your progress here.</p>}
    </div>
  </section>
}
