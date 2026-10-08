import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUSES } from '../../utils/applications'
const empty = { company: '', position: '', location: '', jobUrl: '', status: 'Applied', appliedDate: '', interviewDate: '', notes: '' }
export default function ApplicationForm({ initialValues, onSubmit }) {
  const [values, setValues] = useState(initialValues || empty)
  const [error, setError] = useState('')
  function change(event) { setValues({ ...values, [event.target.name]: event.target.value }) }
  function submit(event) {
    event.preventDefault()
    if (!values.company.trim() || !values.position.trim()) { setError('Company and position are required.'); return }
    if (values.jobUrl && !/^https?:\/\//i.test(values.jobUrl)) { setError('Use a job URL starting with https:// or http://.'); return }
    setError('')
    onSubmit({ ...values, company: values.company.trim(), position: values.position.trim(), jobUrl: values.jobUrl.trim() })
  }
  return <form className="panel application-form" onSubmit={submit}><div className="panel-heading"><div><h2>Opportunity details</h2><p>Keep the essentials together. Fields marked * are required.</p></div></div><div className="form-grid"><label>Company name *<input name="company" required maxLength={120} placeholder="e.g. WSO2" value={values.company} onChange={change} /></label><label>Position *<input name="position" required maxLength={180} placeholder="e.g. Software Engineer Intern" value={values.position} onChange={change} /></label><label>Location<input name="location" maxLength={180} placeholder="e.g. Colombo � Hybrid" value={values.location} onChange={change} /></label><label>Status<select name="status" value={values.status} onChange={change}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><label className="full-width">Job URL<input name="jobUrl" type="url" placeholder="https://company.com/careers/role" value={values.jobUrl} onChange={change} /></label><label>Applied date<input type="date" name="appliedDate" value={values.appliedDate} onChange={change} /></label><label>Interview date<input type="date" name="interviewDate" value={values.interviewDate} onChange={change} /></label><label className="full-width">Notes<textarea rows={5} name="notes" placeholder="Contacts, interview preparation, follow-ups�" value={values.notes} onChange={change} /></label></div>{error && <div className="notice error" role="alert">{error}</div>}<div className="form-actions"><Link className="button secondary" to="/applications">Cancel</Link><button className="button primary" type="submit">{initialValues ? 'Save changes' : 'Add application'} ?</button></div></form>
}
