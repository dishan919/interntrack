import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../../styles/register.css'

export default function DeleteAccount({ onPendingChange }) {
  const { deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [validation, setValidation] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const input = useRef(null)
  function cancel() {
    if (submitting.current) return
    setOpen(false); setPassword(''); setVisible(false); setValidation(''); setError('')
  }
  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    setError(''); setValidation('')
    if (!password.trim()) {
      setValidation('Current password is required.')
      input.current.focus()
      return
    }
    submitting.current = true
    setPending(true)
    onPendingChange(true)
    try {
      await deleteAccount(password)
      setPassword(''); setVisible(false)
      // AuthProvider logs out; the existing protected-route guard goes to /login.
    } catch (failure) { setError(failure.message) }
    finally { submitting.current = false; setPending(false); onPendingChange(false) }
  }
  return <section className="panel profile-panel profile-danger" aria-labelledby="danger-heading">
    <div className="panel-heading"><h2 id="danger-heading">Danger Zone</h2></div>
    <div className="profile-security-intro"><p id="delete-warning">Deleting your account permanently removes your account and all your applications. This cannot be undone.</p></div>
    {!open ? <div className="profile-actions"><button type="button" className="button danger" onClick={() => setOpen(true)}>Delete Account</button></div>
      : <form className="profile-form" aria-label="Delete account" aria-describedby="delete-warning" aria-busy={pending} onSubmit={submit} noValidate>
        {error && <div className="notice error" role="alert">{error}</div>}
        <div className="profile-field"><label htmlFor="delete-current-password">Current Password</label>
          <div className="register-input-wrap"><input ref={input} id="delete-current-password" name="currentPassword" type={visible ? 'text' : 'password'}
            autoComplete="current-password" required disabled={pending} value={password} onChange={event => setPassword(event.target.value)}
            aria-invalid={Boolean(validation)} aria-describedby={validation ? 'delete-password-error' : undefined} />
            <button type="button" className="register-visibility" disabled={pending} aria-controls="delete-current-password"
              aria-label={visible ? 'Hide current password' : 'Show current password'} aria-pressed={visible}
              onClick={() => setVisible(current => !current)}>{visible ? 'Hide' : 'Show'}</button></div>
          {validation && <span id="delete-password-error" role="alert">{validation}</span>}
        </div>
        <div className="profile-actions"><button type="submit" className="button danger" disabled={pending}>{pending ? 'Deleting...' : 'Delete Account'}</button>
          <button type="button" className="button secondary" disabled={pending} onClick={cancel}>Cancel</button></div>
      </form>}
  </section>
}
