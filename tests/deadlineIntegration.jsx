import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ApplicationProvider from '../src/context/ApplicationProvider'
import { useApplications } from '../src/context/ApplicationContext'
import ApplicationForm from '../src/components/applications/ApplicationForm'
import ApplicationCard from '../src/components/applications/ApplicationCard'
import Dashboard from '../src/pages/Dashboard'
import Applications from '../src/pages/Applications'
import ApplicationDetails from '../src/pages/ApplicationDetails'
import { loadApplications } from '../src/services/applicationService'

export default function verifyDeadlineIntegration() {
  const key = 'interntrack_applications'
  const legacy = { id: 'legacy', company: 'WSO2', position: 'Intern', status: 'Applied' }
  const original = JSON.stringify([legacy])
  const store = new Map([[key, original]])
  globalThis.localStorage = { getItem: name => store.get(name) ?? null, setItem: (name, value) => store.set(name, value) }
  let context
  function Capture() { context = useApplications(); return null }
  function capture() { renderToStaticMarkup(<ApplicationProvider><Capture /></ApplicationProvider>) }
  capture()
  assert.equal(store.get(key), original, 'rendering existing records must not rewrite storage')
  const oldApp = context.applications[0]
  const oldForm = renderToStaticMarkup(<MemoryRouter><ApplicationForm initialValues={oldApp} onSubmit={() => {}} /></MemoryRouter>)
  assert.match(oldForm, /type="date" name="deadline" value=""/)
  assert.doesNotMatch(oldForm, /name="deadline" required/)
  const oldCard = renderToStaticMarkup(<MemoryRouter><ApplicationCard application={oldApp} /></MemoryRouter>)
  assert.doesNotMatch(oldCard, /Deadline:/)

  // Exercise the actual Context -> service -> localStorage add/edit path.
  const formValues = { company: 'IFS', position: 'React Intern', status: 'Applied', location: '', jobUrl: '', appliedDate: '', interviewDate: '', notes: '', deadline: '2026-10-25' }
  context.addApplication(formValues)
  capture() // Fresh provider load represents a browser refresh.
  const added = context.applications.find(app => app.company === 'IFS')
  assert.ok(added.id)
  assert.equal(added.deadline, '2026-10-25')
  assert.equal(context.applications.length, 2)
  const editForm = renderToStaticMarkup(<MemoryRouter><ApplicationForm initialValues={added} onSubmit={() => {}} /></MemoryRouter>)
  assert.match(editForm, /type="date" name="deadline" value="2026-10-25"/)
  context.updateApplication(added.id, { ...added, deadline: '2026-10-30' })
  capture()
  assert.equal(context.getApplication(added.id).deadline, '2026-10-30')
  assert.equal(context.getApplication('legacy').company, 'WSO2')
  const card = renderToStaticMarkup(<MemoryRouter><ApplicationCard application={context.getApplication(added.id)} today={new Date(2026, 9, 20)} /></MemoryRouter>)
  assert.match(card, /Deadline:/)
  assert.match(card, /10 days left/)
  context.updateApplication(added.id, { ...context.getApplication(added.id), deadline: '' })
  capture()
  assert.equal(context.getApplication(added.id).deadline, '')
  assert.equal(loadApplications().applications.length, 2)

  // Make one future and one expired deadline; verify rendered dashboard links.
  const future = new Date()
  future.setDate(future.getDate() + 10)
  const futureDeadline = String(future.getFullYear()).padStart(4, '0') + '-' + String(future.getMonth() + 1).padStart(2, '0') + '-' + String(future.getDate()).padStart(2, '0')
  context.updateApplication(added.id, { ...context.getApplication(added.id), deadline: futureDeadline })
  capture()
  context.addApplication({ ...formValues, company: 'Expired Company', deadline: '2000-01-01' })
  const dashboard = renderToStaticMarkup(<MemoryRouter><ApplicationProvider><Dashboard /></ApplicationProvider></MemoryRouter>)
  const section = dashboard.slice(dashboard.indexOf('Upcoming Deadlines'))
  assert.match(section, /10 days left/)
  assert.match(section, new RegExp('href="/applications/' + added.id + '"'))
  assert.doesNotMatch(section, /Expired Company/)
  function details(id) {
    return renderToStaticMarkup(<MemoryRouter initialEntries={['/applications/' + id]}><ApplicationProvider><Routes><Route path="/applications/:id" element={<ApplicationDetails />} /></Routes></ApplicationProvider></MemoryRouter>)
  }
  assert.doesNotMatch(details('legacy'), /Application Deadline/)
  assert.match(details(added.id), /Application Deadline/)
  assert.match(details(added.id), /10 days left/)
  const expired = loadApplications().applications.find(app => app.company === 'Expired Company')
  assert.match(details(expired.id), /Expired/)
  assert.equal(expired.status, 'Applied', 'expired deadlines must not change application status')
  const page = renderToStaticMarkup(<MemoryRouter><ApplicationProvider><Applications /></ApplicationProvider></MemoryRouter>)
  assert.match(page, /Deadline: Soonest/)
  assert.match(page, /Deadline: Latest/)
  assert.match(page, /Expired/)
  assert.match(page, /Search by company or position/)
  assert.match(page, /Filter by status/)
  return 'PASS: legacy form/cards, optional field, Context add/edit/clear deadline, reload persistence, rendered deadline badges, dashboard links/exclusions, and existing search/filter controls'
}
