import { useRef, useState } from 'react'
import { useApplications } from '../../context/ApplicationContext'
import { STATUSES } from '../../utils/applications'
import { KANBAN_DRAG_TYPE, moveApplicationStatus } from '../../utils/kanbanUtils'
import KanbanColumn from './KanbanColumn'
export default function KanbanBoard({ applications, today }) {
  const { getApplication, updateApplication } = useApplications()
  const draggedId = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [destination, setDestination] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  function endDrag() { draggedId.current = null; setDragging(null); setDestination(null) }
  async function move(id, status) {
    const application = getApplication(id)
    if (await moveApplicationStatus(id, status, getApplication, updateApplication)) {
      setAnnouncement(application.company + ' moved to ' + status + '.')
    }
    endDrag()
  }
  function startDrag(event, id) {
    // Interactive fallback controls should never initiate a drag.
    if (event.target.closest('select, option, label')) { event.preventDefault(); return }
    event.dataTransfer.setData(KANBAN_DRAG_TYPE, id)
    event.dataTransfer.effectAllowed = 'move'
    draggedId.current = id
    setDragging(id)
  }
  function overColumn(event, status) {
    const application = getApplication(draggedId.current)
    if (!application) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDestination(application.status === status ? null : status)
  }
  function leaveColumn(event, status) {
    if (!event.currentTarget.contains(event.relatedTarget)) setDestination(current => current === status ? null : current)
  }
  function drop(event, status) {
    event.preventDefault()
    const id = event.dataTransfer.getData(KANBAN_DRAG_TYPE)
    if (draggedId.current && id === draggedId.current) return move(id, status)
    else endDrag()
  }
  return <><div className="kanban-board" role="region" aria-label="Applications board, scroll horizontally to view all status columns" tabIndex={0}>{STATUSES.map(status => <KanbanColumn key={status} status={status} applications={applications.filter(application => application.status === status)} today={today} dragging={dragging} highlighted={destination === status} onDragStart={startDrag} onDragEnd={endDrag} onDragOver={event => overColumn(event, status)} onDragLeave={event => leaveColumn(event, status)} onDrop={event => drop(event, status)} onMove={move} />)}</div><span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span></>
}
