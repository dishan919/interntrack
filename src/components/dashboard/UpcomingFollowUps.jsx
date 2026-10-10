import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/applications'
import { getFollowUpStatus, getUpcomingFollowUps } from '../../utils/followUpUtils'

export default function UpcomingFollowUps({ applications, today }) {
  const upcoming = getUpcomingFollowUps(applications, today)
  return <section className="panel deadlines-panel">
    <div className="panel-heading"><div><h2>Upcoming Follow-ups</h2><p>Your pending reminders, closest first.</p></div></div>
    {upcoming.length ? upcoming.map(app => {
      const status = getFollowUpStatus(app.followUp, today)
      return <Link className="deadline-item" key={app.id} to={'/applications/' + app.id}>
        <div className="deadline-opportunity"><strong>{app.company}</strong><span>{app.position || 'Position not set'}</span></div>
        <span className="deadline-date">{formatDate(app.followUp.date)}</span>
        <span className={'badge deadline-badge deadline-' + status.tone}><span />{status.label}</span>
      </Link>
    }) : <div className="quiet-state">No follow-ups scheduled.</div>}
  </section>
}
