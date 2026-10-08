import { STATUSES } from '../../utils/applications'
import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/applications'
import { getDeadlineStatus } from '../../utils/deadlineUtils'
import { formatInterviewTime, getApplicationInterview, getInterviewStatus } from '../../utils/interviewUtils'
import DeadlineBadge from './DeadlineBadge'
import InterviewBadge from './InterviewBadge'
export default function KanbanCard({ application, today, dragging = false, onDragStart, onDragEnd, onMove }) {
  const interview = getApplicationInterview(application)
  const interviewStatus = getInterviewStatus(interview, today)
  const time = formatInterviewTime(interview.time)
  const deadline = getDeadlineStatus(application.deadline, today)
  return <article className={'kanban-card' + (dragging ? ' kanban-dragging' : '')} draggable={!!onDragStart} onDragStart={event => onDragStart?.(event, application.id)} onDragEnd={onDragEnd}><Link className="kanban-card-link" draggable={false} to={'/applications/' + application.id} aria-label={'View ' + (application.position || 'application') + ' at ' + application.company}><span className="kanban-company">{application.company}</span><strong className="kanban-position">{application.position || 'Position not set'}</strong>{deadline && <div className="kanban-metadata"><span className="kanban-field-label">Deadline</span><span>{formatDate(application.deadline)}</span><DeadlineBadge deadline={application.deadline} today={today} /></div>}{interviewStatus?.upcoming && <div className="kanban-metadata"><span className="kanban-field-label">Interview</span><span>{formatDate(interview.date)}{time && <> · {time}</>}</span><InterviewBadge interview={interview} now={today} /></div>}</Link>{onMove && <label className="kanban-move-control"><span>Move to</span><select aria-label={'Move ' + (application.position || 'application') + ' at ' + application.company + ' to status'} value={application.status} onChange={event => onMove(application.id, event.target.value)} onDragStart={event => event.preventDefault()}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>}</article>
}
