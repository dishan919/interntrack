import { useId } from 'react'
import { formatActivityDate, getNewestActivity } from '../../utils/activityUtils'

export default function ApplicationTimeline({ activity }) {
  const headingId = useId()
  const items = getNewestActivity(activity)
  return <section className="panel activity-panel" aria-labelledby={headingId}>
    <div className="panel-heading"><h2 id={headingId}>Activity timeline</h2></div>
    {items.length ? <ol className="activity-timeline">{items.map(item => <li key={item.id}>
      <div className="activity-message">{item.message}</div>
      <time dateTime={item.createdAt}>{formatActivityDate(item.createdAt)}</time>
    </li>)}</ol> : <div className="quiet-state">No activity yet. Future status, interview, and document changes will appear here.</div>}
  </section>
}
