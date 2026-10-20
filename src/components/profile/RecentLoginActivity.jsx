import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getLoginActivity } from '../../services/authService'
import { formatLoginTime, formatUserAgent } from '../../utils/loginActivity'

export default function RecentLoginActivity() {
  const { user, accessToken } = useAuth()
  // Keying request state prevents private data surviving a user/session change.
  return <LoginHistory key={`${user.id}:${accessToken}`} accessToken={accessToken} />
}
function LoginHistory({ accessToken }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const active = useRef(false)
  const pending = useRef(null)
  function accept(items) { setActivities(items.activities); setError('') }
  useEffect(() => {
    active.current = true
    let subscribed = true
    // Reuse the pending promise when StrictMode replays the mounting effect.
    if (!pending.current) pending.current = getLoginActivity(accessToken)
    pending.current.then(result => {
      if (subscribed) accept(result)
    }, () => {
      if (subscribed) setError('Unable to load login activity. Please try again.')
    }).finally(() => {
      if (subscribed) { pending.current = null; setLoading(false) }
    })
    return () => { subscribed = false; active.current = false }
  }, [accessToken])
  async function refresh() {
    if (pending.current) return
    setLoading(true); setError('')
    pending.current = getLoginActivity(accessToken)
    try {
      const result = await pending.current
      if (active.current) accept(result)
    } catch { if (active.current) setError('Unable to load login activity. Please try again.') }
    finally { if (active.current) { pending.current = null; setLoading(false) } }
  }
  return <section className="panel profile-panel profile-login-activity" aria-labelledby="login-activity-heading" aria-busy={loading}>
    <div className="panel-heading"><h2 id="login-activity-heading">Recent Login Activity</h2>
      <button type="button" className="button secondary" disabled={loading} onClick={refresh}>{loading ? 'Refreshing...' : 'Refresh'}</button></div>
    <div className="login-activity-content">
      <p className="profile-note">Successful logins, newest first. Browser/device labels are estimates from the reported user agent. Times use your browser's local timezone. IP addresses do not identify a physical location.</p>
      {loading ? <p role="status">Loading login activity...</p>
        : error ? <div role="alert"><p>{error}</p><button type="button" className="button secondary" onClick={refresh}>Retry</button></div>
          : !activities.length ? <p>No login activity available.</p>
            : <ol className="login-activity-list">{activities.map(activity => <li key={activity.id}>
              <time dateTime={activity.loggedInAt}>{formatLoginTime(activity.loggedInAt)}</time>
              <span>{formatUserAgent(activity.userAgent)}</span>
              <span>IP address: {activity.ipAddress || 'Unavailable'}</span>
            </li>)}</ol>}
    </div>
  </section>
}
