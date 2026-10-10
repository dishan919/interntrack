import SkillMatch from '../components/applications/SkillMatch'
import DocumentsChecklist from '../components/applications/DocumentsChecklist'
import InterviewDetails from '../components/applications/InterviewDetails'
import { getApplicationInterview } from '../utils/interviewUtils'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useApplications } from '../context/ApplicationContext'
import DeadlineBadge from '../components/applications/DeadlineBadge'
import { getDeadlineStatus } from '../utils/deadlineUtils'
import useDeadlineToday from '../utils/useDeadlineToday'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import { formatDate } from '../utils/applications'
export default function ApplicationDetails() {
  const today = useDeadlineToday()
  const { id } = useParams()
  const { getApplication, deleteApplication } = useApplications()
  const navigate = useNavigate()
  const app = getApplication(id)
  if (!app) return <><Link className="subtle-link" to="/applications">? Back to applications</Link><EmptyState title="Application not found" message="It may have been deleted. Return to your applications to continue." action={false} /></>
  function remove() { if (window.confirm('Delete this application? This cannot be undone.')) { deleteApplication(id); navigate('/applications') } }
  return <><Link className="subtle-link" to="/applications">? Back to applications</Link><div className="page-heading"><div><div className="eyebrow">{app.company}</div><h1>{app.position || 'Position not set'}</h1><p>{app.location || 'Location not set'}</p></div><StatusBadge status={app.status} /></div><section className="panel details-panel"><div className="panel-heading"><h2>Application details</h2><Link className="button primary" to={'/applications/' + id + '/edit'}>Edit application</Link></div><dl className="detail-grid"><div><dt>Company</dt><dd>{app.company}</dd></div><div><dt>Status</dt><dd><StatusBadge status={app.status} /></dd></div><div><dt>Applied date</dt><dd>{formatDate(app.appliedDate)}</dd></div>{getDeadlineStatus(app.deadline, today) && <div><dt>Application Deadline</dt><dd className="detail-deadline"><span>{formatDate(app.deadline)}</span><DeadlineBadge deadline={app.deadline} today={today} /></dd></div>}<div><dt>Location</dt><dd>{app.location || 'Not set'}</dd></div><div><dt>Job URL</dt><dd>{/^https?:\/\//i.test(app.jobUrl) ? <a className="subtle-link" href={app.jobUrl} target="_blank" rel="noopener noreferrer">Open job posting ?</a> : 'Not set'}</dd></div><div className="full-width"><dt>Notes</dt><dd className="notes">{app.notes || 'No notes yet.'}</dd></div></dl><div className="form-actions"><button className="button danger" onClick={remove}>Delete application</button></div></section><DocumentsChecklist application={app} /><SkillMatch skills={app.skills} /><InterviewDetails interview={getApplicationInterview(app)} now={today} /></>
}
