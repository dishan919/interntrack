import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { validateProfile } from '../utils/profile'
import '../styles/profile.css'

export default function Profile() {
  const { user, logout, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({ name: '', email: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const saving = useRef(false)
  const formRef = useRef(null)
  function edit() {
    setValues({ name: user.name, email: user.email })
    setErrors({}); setError(''); setMessage(''); setEditing(true)
  }
  async function save(event) {
    event.preventDefault()
    if (saving.current) return
    const nextErrors = validateProfile(values)
    setErrors(nextErrors); setError('')
    if (Object.keys(nextErrors).length) {
      formRef.current.elements.namedItem(Object.keys(nextErrors)[0]).focus()
      return
    }
    saving.current = true
    setPending(true)
    try {
      await updateProfile({ name: values.name.trim(), email: values.email.trim() })
      setEditing(false)
      setMessage('Profile updated successfully.')
    } catch (failure) { setError(failure.message) }
    finally { saving.current = false; setPending(false) }
  }

  return <>
    <div className="page-heading"><div>
      <div className="eyebrow">YOUR ACCOUNT</div>
      <h1>Profile</h1>
      <p>View your InternTrack account information.</p>
    </div></div>
    {message && <div className="notice" role="status">{message}</div>}
    <section className="panel profile-panel" aria-labelledby="account-heading">
      <div className="panel-heading"><h2 id="account-heading">Account information</h2></div>
      {editing ? <form className="profile-form" ref={formRef} onSubmit={save} noValidate aria-busy={pending}>
        {error && <div className="notice error" role="alert">{error}</div>}
        {['name', 'email'].map(key => <div className="profile-field" key={key}>
          <label htmlFor={`profile-${key}`}>{key === 'name' ? 'Full name' : 'Email address'}</label>
          <input id={`profile-${key}`} name={key} type={key === 'email' ? 'email' : 'text'} autoComplete={key} required disabled={pending}
            value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })}
            aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `profile-${key}-error` : undefined} />
          {errors[key] && <span id={`profile-${key}-error`} role="alert">{errors[key]}</span>}
        </div>)}
        <div className="profile-actions"><button type="submit" className="button primary" disabled={pending}>{pending ? 'Saving...' : 'Save Changes'}</button>
          <button type="button" className="button secondary" disabled={pending} onClick={() => { setEditing(false); setValues({ name: '', email: '' }); setErrors({}); setError('') }}>Cancel</button></div>
      </form> : <>
      <dl className="profile-fields">
        <div><dt>Full name</dt><dd>{user.name}</dd></div>
        <div><dt>Email address</dt><dd>{user.email}</dd></div>
      </dl>
      <div className="profile-actions"><button type="button" className="button secondary" onClick={edit}>Edit Profile</button></div>
      </>}
      <div className="setting-row">
        <div><h3>Your session</h3><p>Sign out when you have finished using your account.</p></div>
        <button type="button" className="button secondary" onClick={logout}>Sign out</button>
      </div>
    </section>
    <p className="profile-note">You can update your name and email. Password changes are not available here.</p>
  </>
}
