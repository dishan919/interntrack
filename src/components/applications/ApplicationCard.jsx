import { Link } from 'react-router-dom'
import StatusBadge from '../common/StatusBadge'
import { formatDate } from '../../utils/applications'
export default function ApplicationCard({ application, onDelete, compact = false }) {
  const app = application
  return <article className="application-row"><div className={'company-logo logo-' + (app.company.length % 4)}>{app.company.slice(0, 2).toUpperCase()}</div><div className="application-title"><Link to={'/applications/' + app.id}>{app.position}</Link><div className="muted">{app.company}{!compact && app.location && <span> � {app.location}</span>}</div></div><StatusBadge status={app.status} /><div className="application-date">{formatDate(app.appliedDate)}<small>Applied date</small></div><div className="row-actions">{compact ? <Link className="arrow-link" aria-label={'View ' + app.position + ' at ' + app.company} to={'/applications/' + app.id}>?</Link> : <><Link to={'/applications/' + app.id}>Details</Link><Link to={'/applications/' + app.id + '/edit'}>Edit</Link><button className="text-danger" onClick={() => onDelete(app)}>Delete</button></>}</div></article>
}
