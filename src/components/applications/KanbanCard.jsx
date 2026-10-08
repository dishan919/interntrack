import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/applications'
import { getDeadlineStatus } from '../../utils/deadlineUtils'
import { formatInterviewTime, getApplicationInterview, getInterviewStatus } from '../../utils/interviewUtils'
import DeadlineBadge from './DeadlineBadge'
import InterviewBadge from './InterviewBadge'
export default function KanbanCard({ application, today }) {
  const interview = getApplicationInterview(application)
  const interviewStatus = getInterviewStatus(interview, today)
  const time = formatInterviewTime(interview.time)
  const deadline = getDeadlineStatus(application.deadline, today)
  return <Link className="kanban-card" to={'/applications/' + application.id} aria-label={'View ' + (application.position || 'application') + ' at ' + application.company}><span className="kanban-company">{application.company}</span><strong className="kanban-position">{application.position || 'Position not set'}</strong>{deadline && <div className="kanban-metadata"><span className="kanban-field-label">Deadline</span><span>{formatDate(application.deadline)}</span><DeadlineBadge deadline={application.deadline} today={today} /></div>}{interviewStatus?.upcoming && <div className="kanban-metadata"><span className="kanban-field-label">Interview</span><span>{formatDate(interview.date)}{time && <> · {time}</>}</span><InterviewBadge interview={interview} now={today} /></div>}</Link>
}
