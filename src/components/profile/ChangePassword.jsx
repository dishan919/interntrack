import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { changePassword } from '../../services/authService'
import { validatePasswordChange } from '../../utils/passwordChange'
import '../../styles/register.css'

const empty = { currentPassword: '', newPassword: '', confirmNewPassword: '' }
const labels = { currentPassword: 'Current Password', newPassword: 'New Password', confirmNewPassword: 'Confirm New Password' }

export default function ChangePassword() {
  const { accessToken } = useAuth()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(empty)
  const [visible, setVisible] = useState({})
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const formRef = useRef(null)

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const nextErrors = validatePasswordChange(values)
    setErrors(nextErrors); setError(''); setMessage('')
    if (Object.keys(nextErrors).length) {
      formRef.current.elements.namedItem(Object.keys(nextErrors)[0]).focus()
      return
    }
    submitting.current = true
    setPending(true)
    try {
      await changePassword(accessToken, { currentPassword: values.currentPassword, newPassword: values.newPassword })
      setValues(empty); setVisible({})
      setMessage('Password changed successfully.')
    } catch (failure) { setError(failure.message) }
    finally { submitting.current = false; setPending(false) }
  }

  return <section className="panel profile-panel" aria-labelledby="security-heading">
    <div className="panel-heading"><h2 id="security-heading">Security</h2></div>
    <div className="profile-security-intro"><p>Provide your current password to set a new one. Use at least 8 characters. Your current session stays signed in.</p></div>
    {!open ? <div className="profile-actions"><button type="button" className="button secondary" onClick={() => setOpen(true)}>Change Password</button></div>
      : <form className="profile-form password-change-form" ref={formRef} onSubmit={submit} noValidate aria-busy={pending} aria-label="Change password">
        {message && <div className="notice" role="status">{message}</div>}
        {error && <div className="notice error" role="alert">{error}</div>}
        {Object.keys(empty).map(key => <div className="profile-field" key={key}>
          <label htmlFor={`security-${key}`}>{labels[key]}</label>
          <div className="register-input-wrap"><input id={`security-${key}`} name={key} type={visible[key] ? 'text' : 'password'}
            autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} required disabled={pending}
            value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })}
            aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `security-${key}-error` : undefined} />
            <button type="button" className="register-visibility" disabled={pending} aria-controls={`security-${key}`}
              aria-label={`${visible[key] ? 'Hide' : 'Show'} ${labels[key].toLowerCase()}`}
              onClick={() => setVisible({ ...visible, [key]: !visible[key] })}>{visible[key] ? 'Hide' : 'Show'}</button></div>
          {errors[key] && <span id={`security-${key}-error`} role="alert">{errors[key]}</span>}
        </div>)}
        <div className="profile-actions"><button type="submit" className="button primary" disabled={pending}>{pending ? 'Changing password...' : 'Change Password'}</button>
          <button type="button" className="button secondary" disabled={pending} onClick={() => { setOpen(false); setValues(empty); setVisible({}); setErrors({}); setError(''); setMessage('') }}>Cancel password change</button></div>
      </form>}
  </section>
}
