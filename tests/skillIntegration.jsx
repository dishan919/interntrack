import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ApplicationProvider, { reloadContext } from './contextHarness'
import { installApi } from './apiMock'
import { useApplications } from '../src/context/ApplicationContext'
import ApplicationForm from '../src/components/applications/ApplicationForm'
import SkillsFormSection from '../src/components/applications/SkillsFormSection'
import SkillMatch from '../src/components/applications/SkillMatch'
import ApplicationDetails from '../src/pages/ApplicationDetails'
import Dashboard from '../src/pages/Dashboard'
import Applications from '../src/pages/Applications'
import { addRequiredSkill, setSkillMatched } from '../src/utils/skillUtils'
export default async function verifySkillIntegration() {
  const key = 'interntrack_applications'
  const legacy = { id: 'legacy', company: 'Legacy', position: 'Intern', status: 'Applied' }
  const original = JSON.stringify([legacy])
  const store = new Map([[key, original]])
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }
  installApi(new Map(store))
  await reloadContext()
  let context, section, form
  function Capture() { context = useApplications(); return null }
  const reload = async () => { await reloadContext(); renderToStaticMarkup(<ApplicationProvider><Capture /></ApplicationProvider>) }
  await reload()
  assert.equal(store.get(key), original)
  assert.equal(renderToStaticMarkup(<SkillMatch />), '')
  let skills = addRequiredSkill(undefined, 'React')
  function Probe() { section = SkillsFormSection({ skills, onChange: next => { skills = next } }); return section }
  const markup = renderToStaticMarkup(<Probe />)
  assert.match(markup, /aria-label="Remove React"/)
  assert.match(markup, /type="checkbox"/)
  const selection = section.props.children.at(-1)
  selection.props.children[1][0].props.children[0].props.onChange({ target: { checked: true } })
  assert.deepEqual(skills.matched, ['React'])
  let prevented = false
  section.props.children[3].props.children[0].props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: false }, preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  section.props.children[2].props.children[0].props.children[1].props.onClick()
  assert.deepEqual(skills, { required: [], matched: [] })
  skills = setSkillMatched(addRequiredSkill(skills, 'React'), 'React', true)
  skills = addRequiredSkill(skills, 'Git')
  const values = { company: 'Skill Company', position: 'Intern', status: 'Applied', skills, deadline: '2027-01-01', interview: { date: '2027-01-02', time: '10:30', type: 'Phone' }, notes: 'Keep notes', location: 'Colombo', jobUrl: 'https://example.com', customField: 'Keep custom data' }
  await context.addApplication(values)
  await reload()
  const added = context.applications.find(app => app.company === values.company)
  assert.deepEqual(added.skills, skills)
  function FormProbe() { form = ApplicationForm({ initialValues: context.getApplication(added.id), onSubmit: next => context.updateApplication(added.id, next) }); return form }
  renderToStaticMarkup(<MemoryRouter><FormProbe /></MemoryRouter>)
  await form.props.onSubmit({ preventDefault() {} })
  await reload()
  assert.deepEqual(context.getApplication(added.id).skills, skills)
  const saved = context.getApplication(added.id)
  await context.updateApplication(added.id, { notes: 'Changed notes', deadline: '2027-01-03', interview: { ...saved.interview, time: '11:00' } })
  await reload()
  assert.deepEqual(context.getApplication(added.id).skills, skills)
  assert.equal(context.getApplication(added.id).customField, values.customField)
  assert.equal(context.getApplication(added.id).createdAt, added.createdAt)
  const details = renderToStaticMarkup(<MemoryRouter initialEntries={['/applications/' + added.id]}><ApplicationProvider><Routes><Route path="/applications/:id" element={<ApplicationDetails />} /></Routes></ApplicationProvider></MemoryRouter>)
  assert.match(details, /50% Match/)
  assert.match(details, /1 of 2 skills/)
  assert.match(details, /Skills to Learn/)
  await context.addApplication({ company: 'Highest', position: 'Intern', status: 'Saved', skills: setSkillMatched({ required: ['React'] }, 'React', true) })
  await reload()
  const dashboard = renderToStaticMarkup(<MemoryRouter><ApplicationProvider><Dashboard /></ApplicationProvider></MemoryRouter>)
  const best = dashboard.slice(dashboard.indexOf('Best Skill Matches'))
  assert.ok(best.indexOf('Highest') < best.indexOf('Skill Company'))
  assert.doesNotMatch(best, /Legacy/)
  assert.match(best, new RegExp('/applications/' + added.id))
  const list = renderToStaticMarkup(<MemoryRouter initialEntries={['/applications?company=gIt']}><ApplicationProvider><Applications /></ApplicationProvider></MemoryRouter>)
  assert.match(list, /Skill Company/)
  assert.doesNotMatch(list, /Highest|Legacy/)
  installApi(new Map([[key, original]]))
  await reloadContext()
  const empty = renderToStaticMarkup(<MemoryRouter><ApplicationProvider><Dashboard /></ApplicationProvider></MemoryRouter>)
  assert.match(empty, /Add required skills when creating or editing/)
  assert.doesNotMatch(empty, /0% match/)
  return 'PASS: skill selection, form submission, Context creation/updates, reload persistence, metadata preservation, details, ranking, legacy empty state and skill search'
}
