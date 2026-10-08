import { useId } from 'react'
import StatusBadge from '../common/StatusBadge'
import KanbanCard from './KanbanCard'
export default function KanbanColumn({ status, applications, today, dragging, highlighted, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onMove }) {
  const titleId = useId()
  return <section className={'kanban-column' + (highlighted ? ' kanban-drop-target' : '')} aria-labelledby={titleId} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}><div className="kanban-column-heading"><h2 id={titleId}><StatusBadge status={status} /></h2><span className="kanban-count" aria-label={applications.length + ' applications'}>{applications.length}</span></div><div className="kanban-column-cards">{applications.length ? applications.map(application => <KanbanCard key={application.id} application={application} today={today} dragging={dragging === application.id} onDragStart={onDragStart} onDragEnd={onDragEnd} onMove={onMove} />) : <p className="kanban-empty">No applications</p>}</div></section>
}
