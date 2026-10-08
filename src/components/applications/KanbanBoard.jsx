import { STATUSES } from '../../utils/applications'
import KanbanColumn from './KanbanColumn'
export default function KanbanBoard({ applications, today }) {
  return <div className="kanban-board" role="region" aria-label="Applications board, scroll horizontally to view all status columns" tabIndex={0}>{STATUSES.map(status => <KanbanColumn key={status} status={status} applications={applications.filter(application => application.status === status)} today={today} />)}</div>
}
