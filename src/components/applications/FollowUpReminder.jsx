import { useId, useState } from 'react'
import { useApplications } from '../../context/ApplicationContext'
import { formatDate } from '../../utils/applications'
import { getFollowUpStatus, normalizeFollowUp, updateFollowUp } from '../../utils/followUpUtils'

export default function FollowUpReminder({ application, today }) {
  const headingId = useId()
  const { getApplication, updateApplication, pending } = useApplications()
  const reminder = normalizeFollowUp(application.followUp)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(reminder)
  const [error, setError] = useState('')
  const status = getFollowUpStatus(reminder, today)
  async function save(event) {
    event.preventDefault()
    if (!normalizeFollowUp(draft).date) { setError('Choose a valid follow-up date.'); return }
    const result = updateFollowUp(application.id, draft, getApplication, updateApplication)
    if (result?.then && !await result) return
    setError('')
    setEditing(false)
  }
  function edit() { setDraft(reminder); setError(''); setEditing(true) }
  return <section className="panel follow-up-panel" aria-labelledby={headingId}>
    <div className="panel-heading"><h2 id={headingId}>Follow-up Reminder</h2></div>
    {reminder.date && !editing ? <>
      <dl className="detail-grid"><div><dt>Date</dt><dd>{formatDate(reminder.date)}</dd></div>
      {reminder.note && <div className="full-width"><dt>Note</dt><dd className="notes">{reminder.note}</dd></div>}
      <div><dt>Status</dt><dd><span className={'badge deadline-badge deadline-' + status.tone}><span />{status.label}</span></dd></div></dl>
      <div className="form-actions">
        {!reminder.completed && <button disabled={pending} className="button primary" onClick={() => updateFollowUp(application.id, { ...reminder, completed: true }, getApplication, updateApplication)}>Mark as Done</button>}
        <button disabled={pending} className="button secondary" onClick={edit}>Edit Reminder</button>
        <button disabled={pending} className="button danger" onClick={() => { updateFollowUp(application.id, null, getApplication, updateApplication); setDraft(normalizeFollowUp(null)) }}>Remove Reminder</button>
      </div>
    </> : <form onSubmit={save}>
      <div className="form-grid">
        <label>Date *<input type="date" required value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
        <label className="full-width">Note<textarea rows={2} maxLength={500} placeholder="Send HR a follow-up email" value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} /></label>
        {reminder.completed && <label><input type="checkbox" checked={draft.completed} onChange={event => setDraft({ ...draft, completed: event.target.checked })} /> Completed</label>}
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="form-actions">
        {editing && <button disabled={pending} type="button" className="button secondary" onClick={() => setEditing(false)}>Cancel</button>}
        <button disabled={pending} className="button primary" type="submit">{reminder.date ? 'Update Reminder' : 'Save Reminder'}</button>
      </div>
    </form>}
  </section>
}
