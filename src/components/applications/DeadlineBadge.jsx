import { getDeadlineStatus } from '../../utils/deadlineUtils'
export default function DeadlineBadge({ deadline, today }) {
  const status = getDeadlineStatus(deadline, today)
  if (!status) return null
  return <span className={'badge deadline-badge deadline-' + status.tone}><span />{status.label}</span>
}
