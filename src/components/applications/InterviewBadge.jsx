import { getInterviewStatus } from '../../utils/interviewUtils'
export default function InterviewBadge({ interview, now }) {
  const status = getInterviewStatus(interview, now)
  if (!status) return null
  return <span className={'badge interview-badge ' + (status.upcoming && status.daysRemaining <= 1 ? 'interview-soon' : 'deadline-neutral')}><span />{status.label}</span>
}
