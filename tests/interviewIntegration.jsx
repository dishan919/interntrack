import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ApplicationProvider from '../src/context/ApplicationProvider'
import { useApplications } from '../src/context/ApplicationContext'
import ApplicationForm from '../src/components/applications/ApplicationForm'
import ApplicationCard from '../src/components/applications/ApplicationCard'
import InterviewDetails from '../src/components/applications/InterviewDetails'
import InterviewFormSection from '../src/components/applications/InterviewFormSection'
import ApplicationDetails from '../src/pages/ApplicationDetails'
import Dashboard from '../src/pages/Dashboard'
import { emptyInterview, prepareInterviewValues, getApplicationInterview, getUpcomingInterviews, formatInterviewTime } from '../src/utils/interviewUtils'

export default function verifyInterviewIntegration() {
  const key = 'interntrack_applications'
  const original = JSON.stringify([{ id: 'legacy', company: 'WSO2', status: 'Applied' }])
  const store = new Map([[key, original]])
  globalThis.localStorage = { getItem: name => store.get(name) ?? null, setItem: (name, value) => store.set(name, value) }
  let context
  function Capture() { context = useApplications(); return null }
  function capture() { renderToStaticMarkup(<ApplicationProvider><Capture /></ApplicationProvider>) }
  capture()
  assert.equal(store.get(key), original)
  const legacyForm = renderToStaticMarkup(<MemoryRouter><ApplicationForm initialValues={context.getApplication('legacy')} onSubmit={() => {}} /></MemoryRouter>)
  assert.match(legacyForm, /Interview Details/)
  assert.match(legacyForm, /type="date" name="date" value=""/)
  assert.match(legacyForm, /type="time" name="time" value=""/)
  assert.doesNotMatch(legacyForm, /name="(?:date|time|stage|type)" required/)
  const legacyCard = renderToStaticMarkup(<MemoryRouter><ApplicationCard application={context.getApplication('legacy')} /></MemoryRouter>)
  assert.match(legacyCard, /Position not set/)
  assert.doesNotMatch(legacyCard, /Interview:/)
  assert.equal(renderToStaticMarkup(<InterviewDetails interview={emptyInterview} />), '')

  const future = new Date()
  future.setDate(future.getDate() + 3)
  const date = String(future.getFullYear()).padStart(4, '0') + '-' + String(future.getMonth() + 1).padStart(2, '0') + '-' + String(future.getDate()).padStart(2, '0')
  const types = [
    { type: 'Online', meetingLink: 'https://meet.google.com/example', location: '' },
    { type: 'On-site', meetingLink: '', location: 'Colombo office' },
    { type: 'Phone', meetingLink: '', location: '' },
  ]
  for (const fields of types) {
    const interview = { ...emptyInterview, ...fields, date, time: fields.type === 'Phone' ? '09:00' : fields.type === 'On-site' ? '11:00' : '10:30', stage: 'Technical Interview', notes: 'Prepare React and JavaScript.' }
    const formSection = renderToStaticMarkup(<InterviewFormSection interview={interview} onChange={() => {}} />)
    assert.match(formSection, /HR Interview/)
    assert.match(formSection, /Final Interview/)
    assert.match(formSection, /Other/)
    if (fields.type === 'Online') {
      assert.match(formSection, /name="meetingLink"/)
      assert.doesNotMatch(formSection, /name="location"/)
    } else if (fields.type === 'On-site') {
      assert.match(formSection, /name="location"/)
      assert.doesNotMatch(formSection, /name="meetingLink"/)
    } else {
      assert.doesNotMatch(formSection, /name="(?:meetingLink|location)"/)
    }
    const values = prepareInterviewValues({ company: fields.type + ' Company', position: 'React Intern', status: 'Applied', location: '', jobUrl: '', appliedDate: '', deadline: date, notes: '', interview })
    context.addApplication(values)
    capture() // Reload the provider from localStorage, as on browser refresh.
    const added = context.applications.find(app => app.company === values.company)
    assert.deepEqual(added.interview, interview)
    assert.equal(added.interviewDate, date)
    const form = renderToStaticMarkup(<MemoryRouter><ApplicationForm initialValues={added} onSubmit={() => {}} /></MemoryRouter>)
    assert.match(form, new RegExp('name="date" value="' + date + '"'))
    assert.match(form, new RegExp('name="time" value="' + interview.time + '"'))
    const details = renderToStaticMarkup(<MemoryRouter initialEntries={['/applications/' + added.id]}><ApplicationProvider><Routes><Route path="/applications/:id" element={<ApplicationDetails />} /></Routes></ApplicationProvider></MemoryRouter>)
    assert.match(details, /Technical Interview/)
    assert.match(details, /Prepare React and JavaScript/)
    assert.match(details, /In 3 days/)
    assert.ok(details.includes(formatInterviewTime(interview.time)))
    if (fields.type === 'Online') assert.match(details, /href="https:\/\/meet.google.com\/example"/)
    if (fields.type === 'On-site') assert.match(details, /Colombo office/)
    if (fields.type === 'Phone') assert.doesNotMatch(details, /Open Meeting|Interview Location/)
    const indicator = renderToStaticMarkup(<MemoryRouter><ApplicationCard application={added} /></MemoryRouter>)
    assert.match(indicator, /Interview:/)
    assert.match(indicator, /Deadline:/)
  }
  context.addApplication({ company: 'Past Company', position: 'Intern', status: 'Applied', interview: { ...emptyInterview, date: '2000-01-01', time: '10:30', type: 'Phone' } })
  capture()
  const past = context.applications.find(app => app.company === 'Past Company')
  const pastCard = renderToStaticMarkup(<MemoryRouter><ApplicationCard application={past} /></MemoryRouter>)
  assert.doesNotMatch(pastCard, /Interview:/)
  assert.match(renderToStaticMarkup(<InterviewDetails interview={past.interview} />), /Past/)
  assert.equal(past.status, 'Applied')
  const dashboard = renderToStaticMarkup(<MemoryRouter><ApplicationProvider><Dashboard /></ApplicationProvider></MemoryRouter>)
  const start = dashboard.indexOf('Upcoming Interviews')
  const section = dashboard.slice(start, dashboard.indexOf('Upcoming Deadlines', start))
  assert.ok(section.indexOf('Phone Company') < section.indexOf('Online Company'))
  assert.ok(section.indexOf('Online Company') < section.indexOf('On-site Company'))
  assert.doesNotMatch(section, /Past Company/)
  assert.match(dashboard, /Upcoming Deadlines/)
  assert.match(dashboard, /Recent applications/)
  for (const item of getUpcomingInterviews(context.applications)) assert.ok(section.includes('/applications/' + item.application.id))

  const online = context.applications.find(app => app.company === 'Online Company')
  context.updateApplication(online.id, prepareInterviewValues({ ...online, interview: { ...online.interview, stage: 'Final Interview', time: '15:45' } }))
  capture()
  assert.equal(context.getApplication(online.id).interview.stage, 'Final Interview')
  assert.equal(context.getApplication(online.id).interview.time, '15:45')
  assert.equal(context.getApplication(online.id).deadline, date)
  context.updateApplication(online.id, prepareInterviewValues({ ...context.getApplication(online.id), interview: emptyInterview }))
  capture()
  assert.equal(context.getApplication(online.id).interview, undefined)
  assert.equal(getApplicationInterview(context.getApplication(online.id)).date, '')
  assert.equal(context.applications.length, 5)
  assert.equal(context.getApplication('legacy').company, 'WSO2')
  return 'PASS: legacy/no-interview records, conditional Online/On-site/Phone forms, details and indicators, Context add/edit/clear, reload persistence, upcoming dashboard sorting/links, and preserved deadline features'
}
