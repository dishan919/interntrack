import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApplications } from '../../context/ApplicationContext'
import * as service from '../../services/notificationService'
import '../../styles/notifications.css'

export default function NotificationBell() {
  const { user, accessToken } = useAuth()
  return <UserNotifications key={`${user.id}:${accessToken}`} token={accessToken} />
}
function UserNotifications({ token }) {
  const { applications } = useApplications()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ notifications: [], unreadCount: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  const sequence = useRef(0)
  const writing = useRef(false)
  const wrapper = useRef(null)
  const trigger = useRef(null)
  const heading = useRef(null)
  const id = useId()
  const load = useCallback(() => {
    const attempt = ++sequence.current
    return service.getNotifications(token).then(result => {
      if (active.current && attempt === sequence.current) { setData(result); setError('') }
    }, failure => {
      if (active.current && attempt === sequence.current) setError(failure.message)
    }).finally(() => { if (active.current && attempt === sequence.current) setLoading(false) })
  }, [token])
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => { load() }, [applications, load])
  useEffect(() => {
    if (!open) return
    heading.current?.focus()
    function dismiss(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setOpen(false); trigger.current?.focus()
      } else if (event.type === 'pointerdown' && !wrapper.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', dismiss)
    document.addEventListener('pointerdown', dismiss)
    return () => { document.removeEventListener('keydown', dismiss); document.removeEventListener('pointerdown', dismiss) }
  }, [open])
  function refresh() { setLoading(true); setError(''); return load() }
  async function markRead(notificationId) {
    if (writing.current || loading) return
    writing.current = true; setSaving(true); setError('')
    try {
      if (notificationId) await service.markNotificationRead(token, notificationId)
      else await service.markAllNotificationsRead(token)
      if (active.current) await refresh()
    } catch (failure) { if (active.current) setError(failure.message) }
    finally { writing.current = false; if (active.current) setSaving(false) }
  }
  function close() { setOpen(false); trigger.current?.focus() }
  return <div className="notification-wrapper" ref={wrapper}>
    <button ref={trigger} type="button" className="notification-bell" aria-busy={loading || saving} aria-label={`Notifications${data.unreadCount ? `, ${data.unreadCount} unread` : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {data.unreadCount > 0 && <span className="notification-count">{data.unreadCount}</span>}
    </button>
    {open && <section id={id} className="notification-panel panel" aria-labelledby={`${id}-heading`} aria-busy={loading || saving}>
      <div className="notification-heading"><h2 ref={heading} tabIndex={-1} id={`${id}-heading`}>Notifications</h2><button type="button" aria-label="Close notifications" onClick={close}>&#215;</button></div>
      <div className="notification-actions"><button type="button" disabled={loading || saving} onClick={refresh}>Refresh notifications</button><button type="button" disabled={loading || saving || !data.unreadCount} onClick={() => markRead()}>Mark all as read</button></div>
      {saving && <p role="status">Updating notifications...</p>}
      {error && <div className="notice error" role="alert">{error} <button type="button" disabled={loading || saving} onClick={refresh}>Retry notifications</button></div>}
      {loading ? <p role="status">Loading notifications...</p> : !data.notifications.length && !error ? <p>No notifications yet.</p> : <ol className="notification-list">{data.notifications.map(item => <li key={item.id} className={item.read ? 'notification-read' : 'notification-unread'}>
        <div className="notification-title"><strong>{item.title}</strong><span>{item.read ? 'Read' : 'Unread'}</span></div>
        <p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        <div className="notification-actions">{item.applicationId && <Link to={`/applications/${item.applicationId}`} onClick={close}>View application</Link>}
          {!item.read && <button type="button" disabled={loading || saving} onClick={() => markRead(item.id)}>Mark as read<span className="sr-only">: {item.title}</span></button>}</div>
      </li>)}</ol>}
    </section>}
  </div>
}
