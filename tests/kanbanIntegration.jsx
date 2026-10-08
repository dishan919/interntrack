import assert from 'node:assert/strict'
import fs from 'node:fs'
import postcss from 'postcss'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ApplicationProvider from '../src/context/ApplicationProvider'
import { useApplications } from '../src/context/ApplicationContext'
import KanbanBoard from '../src/components/applications/KanbanBoard'
import KanbanCard from '../src/components/applications/KanbanCard'
import ViewSwitcher from '../src/components/applications/ViewSwitcher'
import Applications from '../src/pages/Applications'
import ApplicationDetails from '../src/pages/ApplicationDetails'
import { STATUSES } from '../src/utils/applications'
import { sortByDeadline } from '../src/utils/deadlineUtils'
import { loadApplicationView, saveApplicationView } from '../src/services/viewPreferenceService'

export default function verifyKanbanIntegration() {
  const now = new Date(2026, 9, 15, 10)
  const records = [
    { id: 'legacy', company: 'WSO2', status: 'Saved' },
    { id: 'applied', company: 'WSO2', position: 'React Intern', status: 'Applied', deadline: '2026-10-18', interview: { date: '2026-10-16', time: '10:30', type: 'Online', stage: 'Technical' } },
    { id: 'second', company: 'WSO2', position: 'QA Intern', status: 'Applied', deadline: '2026-10-20' },
    { id: 'interview', company: 'IFS', position: 'Intern', status: 'Interview', interviewDate: '2026-10-16' },
    { id: 'offer', company: '99X', position: 'Engineer', status: 'Offer' },
    { id: 'rejected', company: 'Dialog', position: 'Intern', status: 'Rejected', deadline: '2026-10-01', interview: { date: '2026-10-14', time: '10:30' } },
  ]
  const original = JSON.stringify(records)
  const store = new Map([['interntrack_applications', original]])
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }
  function page(query = '') { return renderToStaticMarkup(<MemoryRouter initialEntries={['/applications' + query]}><ApplicationProvider><Applications /></ApplicationProvider></MemoryRouter>) }
  const list = page()
  assert.match(list, /class="application-row"/)
  assert.doesNotMatch(list, /class="kanban-board"/)
  assert.match(list, /List View/)
  assert.match(list, /Board View/)
  assert.match(list, /Deadline: Soonest/)
  assert.match(list, /Filter by status/)
  assert.match(list, /aria-pressed="true"[^>]*>List View/)
  assert.equal(store.get('interntrack_applications'), original)

  // The native buttons expose keyboard activation and the selected state.
  let selected
  const switcher = ViewSwitcher({ view: 'list', onChange: view => { selected = view; saveApplicationView(view) } })
  const buttons = switcher.props.children
  assert.equal(buttons[0].props.type, 'button')
  assert.equal(buttons[0].props['aria-pressed'], true)
  assert.equal(buttons[1].props['aria-pressed'], false)
  buttons[1].props.onClick()
  assert.equal(selected, 'board')
  assert.equal(loadApplicationView(), 'board')
  const boardPage = page() // A new mount reads the saved preference.
  assert.match(boardPage, /class="kanban-board"/)
  assert.doesNotMatch(boardPage, /class="application-row"/)
  assert.match(boardPage, /aria-pressed="true"[^>]*>Board View/)
  assert.equal((boardPage.match(/class="kanban-column"/g) || []).length, STATUSES.length)
  assert.equal((boardPage.match(/class="kanban-card"/g) || []).length, records.length)
  const searched = page('?company=WSO2')
  assert.equal((searched.match(/class="kanban-card"/g) || []).length, 3)
  assert.doesNotMatch(searched, /View Intern at IFS/)
  assert.match(searched, /3 of 6 applications/)

  const filtered = records.filter(app => (app.company + ' ' + (app.position || '')).toLowerCase().includes('wso2') && app.status === 'Applied')
  const sorted = sortByDeadline(filtered, 'latest')
  const filteredBoard = renderToStaticMarkup(<MemoryRouter><KanbanBoard applications={sorted} today={now} /></MemoryRouter>)
  assert.equal((filteredBoard.match(/class="kanban-card"/g) || []).length, 2)
  assert.match(filteredBoard, /aria-label="2 applications"/)
  assert.equal((filteredBoard.match(/No applications/g) || []).length, 4)
  assert.ok(filteredBoard.indexOf('/applications/second') < filteredBoard.indexOf('/applications/applied'))

  const card = renderToStaticMarkup(<MemoryRouter><KanbanCard application={records[1]} today={now} /></MemoryRouter>)
  assert.match(card, /href="\/applications\/applied"/)
  assert.match(card, /WSO2/)
  assert.match(card, /React Intern/)
  assert.match(card, /3 days left/)
  assert.match(card, /Tomorrow/)
  assert.match(card, /Deadline/)
  assert.match(card, /Interview/)
  const minimal = renderToStaticMarkup(<MemoryRouter><KanbanCard application={records[0]} today={now} /></MemoryRouter>)
  assert.match(minimal, /Position not set/)
  assert.doesNotMatch(minimal, /kanban-metadata/)
  const past = renderToStaticMarkup(<MemoryRouter><KanbanCard application={records[5]} today={now} /></MemoryRouter>)
  assert.match(past, /Expired/)
  assert.doesNotMatch(past, /kanban-field-label">Interview/)
  const legacyInterview = renderToStaticMarkup(<MemoryRouter><KanbanCard application={records[3]} today={now} /></MemoryRouter>)
  assert.match(legacyInterview, /Tomorrow/)
  const details = renderToStaticMarkup(<MemoryRouter initialEntries={['/applications/applied']}><ApplicationProvider><Routes><Route path="/applications/:id" element={<ApplicationDetails />} /></Routes></ApplicationProvider></MemoryRouter>)
  assert.match(details, /Application details/)
  assert.match(details, /Technical Interview/)
  assert.equal(store.get('interntrack_applications'), original, 'rendering/switching views must not alter application records')

  let context
  function Capture() { context = useApplications(); return null }
  renderToStaticMarkup(<ApplicationProvider><Capture /></ApplicationProvider>)
  context.updateApplication('applied', { status: 'Offer' })
  const afterEdit = page()
  const columns = afterEdit.split('<section class="kanban-column"')
  assert.match(columns[2], /aria-label="1 applications"/)
  assert.match(columns[4], /aria-label="2 applications"/)
  buttons[0].props.onClick()
  assert.equal(loadApplicationView(), 'list')
  assert.match(page(), /class="application-row"/)

  // Check board-specific responsive rules without changing the existing list layout.
  const css = postcss.parse(fs.readFileSync('src/styles/global.css', 'utf8'))
  let desktopWidth, mobileWidth, overflow, keyboardFocus
  css.walkRules(rule => {
    if (rule.selector === '.kanban-board') rule.walkDecls('overflow-x', declaration => { overflow = declaration.value })
    if (rule.selector === '.kanban-board:focus-visible') keyboardFocus = true
    if (rule.selector === '.kanban-column') {
      const mobile = rule.parent.type === 'atrule' && rule.parent.params.includes('max-width: 640px')
      rule.walkDecls('min-width', declaration => { if (mobile) mobileWidth = declaration.value; else desktopWidth = declaration.value })
    }
  })
  assert.equal(overflow, 'auto')
  assert.equal(desktopWidth, '272px')
  assert.equal(mobileWidth, '260px')
  assert.ok(keyboardFocus)
  assert.equal(records[1].status, 'Applied', 'input records must not be mutated')
  return 'PASS: List/Board selection and reload preference, grouping/counts, shared search input, filtered/sorted board data, metadata, links, status updates, application-data isolation, and responsive scroll/focus CSS'
}
