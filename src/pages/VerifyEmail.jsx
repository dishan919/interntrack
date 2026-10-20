import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { verifyEmail, INVALID_VERIFICATION_MESSAGE } from '../services/authService'
import '../styles/register.css'

export default function VerifyEmail() {
  const [params, setParams] = useSearchParams()
  const token = params.get('token') || ''
  const { accessToken, refreshCurrentUser } = useAuth()
  const [result, setResult] = useState(null)
  const [refreshError, setRefreshError] = useState('')
  const request = useRef(null)
  useEffect(() => {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return
    let active = true
    // React StrictMode replays effects; reuse the pending request on that replay.
    if (request.current?.token !== token) request.current = { token, promise: verifyEmail(token) }
    request.current.promise.then(value => {
      if (!active) return
      request.current = null
      setResult({ success: true, message: value.message })
      setParams({}, { replace: true })
    }, failure => {
      if (active) setResult({ success: false, message: failure.message })
    })
    return () => { active = false }
  }, [token, setParams])
  useEffect(() => {
    if (!result?.success || !accessToken) return
    let active = true
    refreshCurrentUser().catch(() => {
      if (active) setRefreshError('Email verified. Unable to refresh your profile. Try refreshing your account status below.')
    })
    return () => { active = false }
  }, [result, accessToken, refreshCurrentUser])
  const validToken = /^[a-f0-9]{64}$/.test(token)
  const message = result?.message || (!token ? 'A verification token is required. Request a new link from your profile.' : !validToken ? INVALID_VERIFICATION_MESSAGE : 'Verifying your email...')
  return <main className="register-page"><section className="register-card" aria-labelledby="verify-heading">
    <h1 id="verify-heading">Verify email</h1>
    <p role={result?.success || (!result && validToken) ? 'status' : 'alert'}>{message}</p>
    {refreshError && <div role="alert"><p>{refreshError}</p><button type="button" onClick={async () => {
      try { await refreshCurrentUser(); setRefreshError('') } catch { /* Keep safe retry message. */ }
    }}>Refresh account status</button></div>}
    {accessToken ? <Link to="/profile">Back to profile</Link> : <Link to="/login">Back to login</Link>}
  </section></main>
}
