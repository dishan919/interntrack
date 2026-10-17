import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ApplicationProvider, { reloadContext } from './contextHarness'
import { installApi } from './apiMock'
import { useApplications } from '../src/context/ApplicationContext'
import KanbanBoard from '../src/components/applications/KanbanBoard'
import KanbanCard from '../src/components/applications/KanbanCard'
import KanbanColumn from '../src/components/applications/KanbanColumn'
import Applications from '../src/pages/Applications'
import { KANBAN_DRAG_TYPE } from '../src/utils/kanbanUtils'

export default async function verifyKanbanDragIntegration() {
  const key = 'interntrack_applications'
  const originalApp = { id: 'IFS', company: 'IFS', position: 'React Intern', status: 'Applied', deadline: '2026-10-20', interviewDate: '2026-10-15', interview: { date: '2026-10-15', time: '10:30', type: 'Online', stage: 'Technical Interview', meetingLink: 'https://meet.google.com/example', location: '', notes: 'Prepare React' }, location: 'Colombo', jobUrl: 'https://example.com', appliedDate: '2026-10-01', notes: 'Do not change these notes', createdAt: '2026-10-01T10:00:00Z', customField: 'Preserve even unknown fields', skills: { required: ['React', 'Git'], matched: ['React'] } }
  const other = { ...originalApp, id: 'other', company: 'WSO2', status: 'Saved' }
  const initial = JSON.stringify([originalApp, other])
  const store = new Map([[key, initial]])
  let writes = 0
  globalThis.localStorage = { getItem: name => store.get(name) ?? null, setItem: (name, value) => { writes++; store.set(name, value) } }
  installApi(store, key, () => { writes++ })
  await reloadContext()
  let board, context
  // Capture the real Board event handlers during React rendering, without a browser.
  function BoardProbe() {
    context = useApplications()
    board = KanbanBoard({ applications: context.applications, today: new Date(2026, 9, 10) })
    return board
  }
  async function mount() { await reloadContext(); return renderToStaticMarkup(<MemoryRouter><ApplicationProvider><BoardProbe /></ApplicationProvider></MemoryRouter>) }
  function column(status) { return board.props.children[0].props.children.find(element => element.props.status === status) }
  function dragEvent() {
    const data = new Map()
    return { target: { closest: () => null }, dataTransfer: { setData: (type, value) => data.set(type, value), getData: type => data.get(type) || '', effectAllowed: '', dropEffect: '' }, prevented: false, preventDefault() { this.prevented = true } }
  }
  let expectedActivity = []
  function assertPreserved(status, previousStatus) {
    const stored = JSON.parse(store.get(key))
    const { activity, ...application } = stored.find(app => app.id === 'IFS')
    assert.deepEqual(application, { ...originalApp, status })
    // Status moves append timeline events while preserving all application metadata.
    if (previousStatus !== status) {
      assert.equal(activity.length, expectedActivity.length + 1)
      assert.deepEqual(activity.slice(0, -1), expectedActivity)
      const event = activity.at(-1)
      assert.equal(event.type, 'status_changed')
      assert.equal(event.message, `Status changed from ${previousStatus} to ${status}`)
      assert.equal(typeof event.id, 'string')
      assert.ok(event.id.length > 0)
      assert.ok(!expectedActivity.some(item => item.id === event.id))
      assert.ok(Number.isFinite(Date.parse(event.createdAt)))
      expectedActivity = activity
    } else {
      assert.deepEqual(activity, expectedActivity)
    }
    assert.deepEqual(context.getApplication('IFS').activity, expectedActivity)
    assert.deepEqual(stored.find(app => app.id === 'other'), other)
  }
  const initialMarkup = await mount()
  assert.equal(writes, 0)
  assert.equal(store.get(key), initial)
  assert.match(initialMarkup, /draggable="true"/)
  assert.match(initialMarkup, /Move to/)
  assert.match(initialMarkup, /aria-label="Move React Intern at IFS to status"/)

  async function dropTo(from, to) {
    const source = column(from)
    const event = dragEvent()
    const card = KanbanCard({ application: context.getApplication('IFS'), today: new Date(2026, 9, 10), onDragStart: source.props.onDragStart, onDragEnd: source.props.onDragEnd, onMove: source.props.onMove })
    card.props.onDragStart(event)
    assert.equal(event.dataTransfer.getData(KANBAN_DRAG_TYPE), 'IFS')
    assert.equal(event.dataTransfer.effectAllowed, 'move')
    column(to).props.onDragOver(event)
    assert.equal(event.prevented, true)
    assert.equal(event.dataTransfer.dropEffect, 'move')
    await column(to).props.onDrop(event)
    const markup = await mount() // A new provider load also verifies refresh persistence.
    assert.equal(context.getApplication('IFS').status, to)
    assert.equal(column(to).props.applications.filter(app => app.id === 'IFS').length, 1)
    if (from !== to) assert.equal(column(from).props.applications.filter(app => app.id === 'IFS').length, 0)
    assertPreserved(to, from)
    return markup
  }
  await dropTo('Applied', 'Interview')
  assert.equal(column('Applied').props.applications.length, 0)
  assert.equal(column('Interview').props.applications.length, 1)
  const noOpWrites = writes
  await dropTo('Interview', 'Interview')
  assert.equal(writes, noOpWrites)
  await dropTo('Interview', 'Offer')
  assert.equal(column('Offer').props.applications.length, 1)

  // Exercise the actual select fallback handler, then drag Interview -> Rejected.
  const fallback = KanbanCard({ application: context.getApplication('IFS'), onMove: column('Offer').props.onMove })
  const label = fallback.props.children[1]
  const select = label.props.children[1]
  assert.equal(select.props.value, 'Offer')
  await select.props.onChange({ target: { value: 'Interview' } })
  await mount()
  assertPreserved('Interview', 'Offer')
  await dropTo('Interview', 'Rejected')
  assert.equal(column('Rejected').props.applications.length, 1)

  // List View reads the same updated Context record.
  const list = renderToStaticMarkup(<MemoryRouter><ApplicationProvider><Applications /></ApplicationProvider></MemoryRouter>)
  const ifsRow = list.slice(list.indexOf('class="application-row"'), list.indexOf('</article>'))
  assert.match(ifsRow, /IFS/)
  assert.match(ifsRow, /badge-rejected/)
  const currentWrites = writes
  column('Offer').props.onDrop(dragEvent()) // External/unknown drags are ignored.
  assert.equal(writes, currentWrites)
  const protectedEvent = dragEvent()
  protectedEvent.target.closest = () => ({ tagName: 'SELECT' })
  column('Rejected').props.onDragStart(protectedEvent, 'IFS')
  assert.equal(protectedEvent.prevented, true)
  assert.equal(protectedEvent.dataTransfer.getData(KANBAN_DRAG_TYPE), '')
  const dragAppearance = renderToStaticMarkup(<MemoryRouter><KanbanCard application={originalApp} dragging onDragStart={() => {}} /></MemoryRouter>)
  assert.match(dragAppearance, /kanban-dragging/)
  const destination = renderToStaticMarkup(<MemoryRouter><KanbanColumn status="Offer" applications={[]} highlighted /></MemoryRouter>)
  assert.match(destination, /kanban-drop-target/)
  return 'PASS: real card/board drag handlers, Applied -> Interview, Interview -> Offer/Rejected, same-column no-op, refresh persistence, unchanged metadata, counts, List synchronization, select fallback, external-drag rejection, and feedback classes'
}
