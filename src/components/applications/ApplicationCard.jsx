import SkillMatch from './SkillMatch'
import InterviewBadge from './InterviewBadge'
import { formatInterviewTime, getApplicationInterview, getInterviewStatus } from '../../utils/interviewUtils'
import { Link } from 'react-router-dom'
import DeadlineBadge from './DeadlineBadge'
import { getDeadlineStatus } from '../../utils/deadlineUtils'
import StatusBadge from '../common/StatusBadge'
import { formatDate } from '../../utils/applications'
export default function ApplicationCard({ application, onDelete, compact = false, today }) {
  const app = application
  const interview = getApplicationInterview(app)
  const interviewStatus = getInterviewStatus(interview, today)
  const interviewTime = formatInterviewTime(interview.time)
  const deadlineStatus = getDeadlineStatus(app.deadline, today)
  return <article className="application-row"><div className={'company-logo logo-' + (app.company.length % 4)}>{app.company.slice(0, 2).toUpperCase()}</div><div className="application-title"><Link to={'/applications/' + app.id}>{app.position || 'Position not set'}</Link><div className="muted">{app.company}{!compact && app.location && <span> � {app.location}</span>}</div><SkillMatch skills={app.skills} compact />{!compact && deadlineStatus && <div className="application-deadline"><span>Deadline: {formatDate(app.deadline)}</span><DeadlineBadge deadline={app.deadline} today={today} /></div>}{!compact && interviewStatus?.upcoming && <div className="application-interview"><span>Interview: {formatDate(interview.date)}{interviewTime && <> · {interviewTime}</>}</span><InterviewBadge interview={interview} now={today} /></div>}</div><StatusBadge status={app.status} /><div className="application-date">{formatDate(app.appliedDate)}<small>Applied date</small></div><div className="row-actions">{compact ? <Link className="arrow-link" aria-label={'View ' + app.position + ' at ' + app.company} to={'/applications/' + app.id}>?</Link> : <><Link to={'/applications/' + app.id}>Details</Link><Link to={'/applications/' + app.id + '/edit'}>Edit</Link><button className="text-danger" onClick={() => onDelete(app)}>Delete</button></>}</div></article>
}
