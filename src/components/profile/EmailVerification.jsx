import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { resendEmailVerification } from '../../services/authService'

export default function EmailVerification() {
  const { user, accessToken, refreshCurrentUser } = useAuth()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  async function resend() {
    if (submitting.current) return
    submitting.current = true
    setPending(true); setMessage(''); setError('')
    try {
      const result = await resendEmailVerification(accessToken)
      setMessage(result.message)
      await refreshCurrentUser()
    } catch (failure) { setError(failure.message) }
    finally { submitting.current = false; setPending(false) }
  }
  return <div className="setting-row" aria-busy={pending}>
    <div><h3>Email verification</h3><p>Status: <strong>{user.emailVerified === true ? 'Verified' : 'Not verified'}</strong></p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
    {user.emailVerified !== true && <button type="button" className="button secondary" disabled={pending} onClick={resend}>{pending ? 'Requesting verification...' : 'Resend Verification'}</button>}
  </div>
}
