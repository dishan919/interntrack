import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { register } from '../services/authService'
import { validateRegistration } from '../utils/registration'
import '../styles/register.css'

const empty = { name: '', email: '', password: '', confirmPassword: '' }
const fields = [
  { name: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
]

export default function Register() {
  const [values, setValues] = useState(empty)
  const [visible, setVisible] = useState({ password: false, confirmPassword: false })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [user, setUser] = useState(null)
  const submitting = useRef(false)
  const formRef = useRef(null)

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const nextErrors = validateRegistration(values)
    setErrors(nextErrors)
    setError('')
    if (Object.keys(nextErrors).length) {
      formRef.current.elements.namedItem(Object.keys(nextErrors)[0]).focus()
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const result = await register(values)
      setValues(empty)
      setUser(result.user)
    } catch (failure) {
      setError(failure.message)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return <main className="register-page">
    <div className="register-brand"><span className="brand-icon" aria-hidden="true" />InternTrack<span className="brand-dot">.</span></div>
    <section className="register-card" aria-labelledby="register-heading">
      <div className="register-eyebrow">YOUR NEXT CHAPTER</div>
      <h1 id="register-heading">Create your account</h1>
      <p>One place to organize your applications and keep your next move in sight.</p>
      {user ? <div className="register-success" role="status"><h2>Account created successfully.</h2><p>Thanks, {user.name}. Your account is ready. You can now sign in.</p></div>
        : <form ref={formRef} onSubmit={submit} noValidate aria-busy={pending}>
          {error && <div className="notice error" role="alert">{error}</div>}
          {fields.map(field => <div className="register-field" key={field.name}>
            <label htmlFor={`register-${field.name}`}>{field.label}</label>
            <div className="register-input-wrap">
            <input {...field} type={field.type === 'password' && visible[field.name] ? 'text' : field.type} id={`register-${field.name}`} required disabled={pending}
              minLength={field.type === 'password' ? 8 : undefined}
              value={values[field.name]} aria-invalid={Boolean(errors[field.name])}
              aria-describedby={errors[field.name] ? `${field.name}-error` : field.name === 'password' ? 'password-hint' : undefined}
              onChange={event => setValues({ ...values, [field.name]: event.target.value })} />
            {field.type === 'password' && <button type="button" className="register-visibility" disabled={pending}
              aria-label={`${visible[field.name] ? 'Hide' : 'Show'} ${field.name === 'confirmPassword' ? 'confirm password' : 'password'}`}
              aria-controls={`register-${field.name}`}
              onClick={() => setVisible(current => ({ ...current, [field.name]: !current[field.name] }))}>
              {visible[field.name] ? 'Hide' : 'Show'}
            </button>}
            </div>
            {errors[field.name] ? <span className="register-error" id={`${field.name}-error`} role="alert">{errors[field.name]}</span>
              : field.name === 'password' && <span id="password-hint" className="register-hint">Use at least 8 characters.</span>}
          </div>)}
          <button className="button primary register-submit" type="submit" disabled={pending}>{pending ? 'Creating account...' : 'Create account'}</button>
          {pending && <span className="register-hint" role="status">Creating your account...</span>}
        </form>}
      <p className="register-login">Already have an account? <Link to="/login">Sign in</Link></p>
    </section>
    <p className="register-footer">Made for your next move.</p>
  </main>
}
