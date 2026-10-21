import { useId, useRef, useState } from 'react'
import { useApplications } from '../../context/ApplicationContext'

const LIMIT = 2000
export default function ApplicationNotes({ application }) {
  const headingId = useId()
  const inputId = useId()
  const { saveApplicationNote, deleteApplicationNote, pending } = useApplications()
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const textarea = useRef(null)
  const notes = Array.isArray(application.applicationNotes) ? application.applicationNotes : []
  const disabled = busy || pending

  function cancel() { setText(''); setEditingId(null); setError('') }
  async function perform(operation, onSuccess) {
    if (submitting.current || pending) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      if (await operation()) onSuccess()
      else setError('Unable to save your note changes. Please try again.')
    } catch { setError('Unable to save your note changes. Please try again.') }
    finally { submitting.current = false; setBusy(false) }
  }
  function save(event) {
    event.preventDefault()
    if (submitting.current || pending) return
    if (!text.trim()) { setError('Note text is required.'); textarea.current?.focus(); return }
    if (text.trim().length > LIMIT) { setError(`Notes must be at most ${LIMIT} characters.`); return }
    return perform(() => saveApplicationNote(application.id, text.trim(), editingId), cancel)
  }
  return <section className="panel application-notes-panel" aria-labelledby={headingId}>
    <div className="panel-heading"><div><h2 id={headingId}>Notes</h2><p>Private notes for this application.</p></div></div>
    <div className="application-notes-content">
      {typeof application.notes === 'string' && application.notes.trim() && <div className="application-note"><h3>Legacy note</h3><p className="notes">{application.notes}</p><small>You can update this earlier note through Edit application.</small></div>}
      {notes.length === 0 ? <p>No notes yet. Add your first note below.</p> : <ul className="application-notes-list">{notes.map(note => <li className="application-note" key={note.id}>
        <p className="notes">{note.text}</p>
        <small>Created <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>{note.updatedAt !== note.createdAt && <> · Updated <time dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleString()}</time></>}</small>
        <div className="note-actions">
          <button type="button" className="button secondary" disabled={disabled} onClick={() => { setText(note.text); setEditingId(note.id); setError(''); textarea.current?.focus() }}>Edit</button>
          <button type="button" className="button danger" disabled={disabled} onClick={() => perform(() => deleteApplicationNote(application.id, note.id), () => { if (editingId === note.id) cancel() })}>Delete</button>
        </div>
      </li>)}</ul>}
      <form onSubmit={save} aria-busy={busy} noValidate>
        <label htmlFor={inputId}>{editingId ? 'Edit note' : 'Add a note'}</label>
        <textarea ref={textarea} id={inputId} rows={4} maxLength={LIMIT} required disabled={disabled} value={text} onChange={event => setText(event.target.value)} aria-describedby={`${inputId}-help`} />
        <small id={`${inputId}-help`}>{text.length}/{LIMIT} characters. Plain text only.</small>
        {error && <div className="notice error" role="alert">{error}</div>}
        {busy && <p role="status">Saving note changes...</p>}
        <div className="note-actions"><button className="button primary" type="submit" disabled={disabled}>Save</button><button className="button secondary" type="button" disabled={disabled} onClick={cancel}>Cancel</button></div>
      </form>
    </div>
  </section>
}
