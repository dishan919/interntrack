import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { requestPasswordReset, resetPassword, INVALID_RESET_MESSAGE } from '../services/authService'
import { validateResetEmail, validateResetPassword } from '../utils/passwordReset'
import '../styles/register.css'

export default function PasswordReset({ reset = false }) {
  const [params, setParams] = useSearchParams()
  const token = params.get('token') || ''
  const [values, setValues] = useState({ email: '', newPassword: '', confirmNewPassword: '' })
  const [visible, setVisible] = useState({})
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const form = useRef(null)
  const invalidToken = reset && !/^[a-f0-9]{64}$/.test(token)
  async function submit(event) {
    event.preventDefault()
    if (submitting.current || invalidToken || (reset && message)) return
    const emailError = validateResetEmail(values.email)
    const next = reset ? validateResetPassword(values) : emailError ? { email: emailError } : {}
    setErrors(next)
    setError('')
    if (Object.keys(next).length) {
      form.current.elements.namedItem(Object.keys(next)[0]).focus()
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const result = reset ? await resetPassword(token, values.newPassword) : await requestPasswordReset(values.email)
      setValues({ email: '', newPassword: '', confirmNewPassword: '' })
      setVisible({})
      setMessage(result.message)
      if (reset) setParams({}, { replace: true })
    } catch (failure) { setError(failure.message) }
    finally { submitting.current = false; setPending(false) }
  }
  return <main className="register-page">
    <div className="register-brand">InternTrack<span className="brand-dot">.</span></div>
    <section className="register-card" aria-labelledby="reset-heading">
      <h1 id="reset-heading">{reset ? 'Reset password' : 'Forgot password?'}</h1>
      {message && <p role="status">{message}</p>}
      {!message && invalidToken && <p role="alert">{INVALID_RESET_MESSAGE} <Link to="/forgot-password">Request a new link</Link></p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {!(reset && (message || invalidToken)) && <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
        {(reset ? [['newPassword', 'New Password'], ['confirmNewPassword', 'Confirm New Password']] : [['email', 'Email']]).map(([name, label]) => <div className="register-field" key={name}>
          <label htmlFor={`reset-${name}`}>{label}</label>
          <div className="register-input-wrap">
            <input id={`reset-${name}`} name={name} type={name === 'email' ? 'email' : visible[name] ? 'text' : 'password'}
              autoComplete={name === 'email' ? 'email' : 'new-password'} required disabled={pending}
              value={values[name]} onChange={event => setValues({ ...values, [name]: event.target.value })}
              aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `reset-${name}-error` : undefined} />
            {name !== 'email' && <button type="button" className="register-visibility" disabled={pending}
              aria-label={`${visible[name] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-controls={`reset-${name}`}
              aria-pressed={Boolean(visible[name])} onClick={() => setVisible({ ...visible, [name]: !visible[name] })}>{visible[name] ? 'Hide' : 'Show'}</button>}
          </div>
          {errors[name] && <span id={`reset-${name}-error`} className="register-error" role="alert">{errors[name]}</span>}
        </div>)}
        <button className="button primary register-submit" type="submit" disabled={pending}>{pending ? 'Submitting...' : reset ? 'Reset Password' : 'Send Reset Instructions'}</button>
      </form>}
      <p className="register-login"><Link to="/login">Back to login</Link></p>
    </section>
  </main>
}
