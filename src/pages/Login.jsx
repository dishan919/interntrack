import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { login } from '../services/authService'
import { validateLogin } from '../utils/login'
import '../styles/register.css'

export default function Login() {
  const [values, setValues] = useState({ email: '', password: '' })
  const [visible, setVisible] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [user, setUser] = useState(null)
  const submitting = useRef(false)
  const formRef = useRef(null)

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const nextErrors = validateLogin(values)
    setErrors(nextErrors)
    setError('')
    if (Object.keys(nextErrors).length) {
      formRef.current.elements.namedItem(Object.keys(nextErrors)[0]).focus()
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const { user: safeUser } = await login(values)
      setValues({ email: '', password: '' })
      setVisible(false)
      setUser(safeUser)
    } catch (failure) {
      setError(failure.message)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return <main className="register-page">
    <div className="register-brand"><span className="brand-icon" aria-hidden="true" />InternTrack<span className="brand-dot">.</span></div>
    <section className="register-card" aria-labelledby="login-heading">
      <div className="register-eyebrow">WELCOME BACK</div>
      <h1 id="login-heading">Sign in to InternTrack</h1>
      <p>Your next opportunity starts with a small step.</p>
      {user ? <div className="register-success" role="status"><h2>Signed in successfully.</h2><p>Welcome back, {user.name}. Your credentials have been verified.</p></div>
        : <form ref={formRef} onSubmit={submit} noValidate aria-busy={pending}>
          {error && <div className="notice error" role="alert">{error}</div>}
          <div className="register-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="email" required disabled={pending}
              value={values.email} onChange={event => setValues({ ...values, email: event.target.value })}
              aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined} />
            {errors.email && <span id="login-email-error" className="register-error" role="alert">{errors.email}</span>}
          </div>
          <div className="register-field">
            <label htmlFor="login-password">Password</label>
            <div className="register-input-wrap">
              <input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required minLength={8} disabled={pending}
                value={values.password} onChange={event => setValues({ ...values, password: event.target.value })}
                aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined} />
              <button type="button" className="register-visibility" disabled={pending} aria-label={visible ? 'Hide password' : 'Show password'}
                aria-controls="login-password" onClick={() => setVisible(current => !current)}>{visible ? 'Hide' : 'Show'}</button>
            </div>
            {errors.password && <span id="login-password-error" className="register-error" role="alert">{errors.password}</span>}
          </div>
          <button type="submit" className="button primary register-submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</button>
          {pending && <span role="status" className="register-hint">Signing in...</span>}
        </form>}
      <p className="register-login">New to InternTrack? <Link to="/register">Create an account</Link></p>
    </section>
    <p className="register-footer">Made for your next move.</p>
  </main>
}
