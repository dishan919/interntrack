import { formatDate } from '../../utils/applications'
import { formatInterviewTime, getInterviewStageLabel, hasInterviewDetails, isSafeMeetingLink } from '../../utils/interviewUtils'
import InterviewBadge from './InterviewBadge'
export default function InterviewDetails({ interview, now }) {
  if (!hasInterviewDetails(interview)) return null
  const time = formatInterviewTime(interview.time)
  return <section className="panel interview-details-panel"><div className="panel-heading"><h2>Interview</h2><InterviewBadge interview={interview} now={now} /></div><dl className="detail-grid">{interview.stage && <div><dt>Stage</dt><dd>{getInterviewStageLabel(interview.stage)}</dd></div>}{interview.date && <div><dt>Interview Date</dt><dd>{formatDate(interview.date)}</dd></div>}{time && <div><dt>Interview Time</dt><dd>{time}</dd></div>}{interview.type && <div><dt>Type</dt><dd>{interview.type}</dd></div>}{interview.type === 'Online' && isSafeMeetingLink(interview.meetingLink) && <div><dt>Meeting Link</dt><dd><a className="subtle-link" href={interview.meetingLink} target="_blank" rel="noopener noreferrer">Open Meeting</a></dd></div>}{interview.type === 'On-site' && interview.location && <div><dt>Interview Location</dt><dd>{interview.location}</dd></div>}{interview.notes && <div className="full-width"><dt>Interview Notes</dt><dd className="notes">{interview.notes}</dd></div>}</dl></section>
}
