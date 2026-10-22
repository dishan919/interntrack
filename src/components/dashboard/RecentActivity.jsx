import { Link } from 'react-router-dom'
import { formatActivityDate, getNewestActivity } from '../../utils/activityUtils'
export default function RecentActivity({ applications }) {
  const items = applications.flatMap(application => getNewestActivity(application.activity).map(item => ({ ...item, application })))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5)
  return <section className="panel dashboard-activity"><div className="panel-heading"><div><h2>Recent activity</h2><p>The latest moves in your search.</p></div></div>{items.length ? <ol className="dashboard-activity-list">{items.map(item => <li key={`${item.application.id}:${item.id}`}><span className="activity-marker" aria-hidden="true" /><div><Link to={'/applications/' + item.application.id}>{item.application.company}</Link><p>{item.message}</p><time dateTime={item.createdAt}>{formatActivityDate(item.createdAt)}</time></div></li>)}</ol> : <div className="quiet-state"><strong>A fresh start</strong><p>Your application activity will appear here as you make progress.</p></div>}</section>
}
