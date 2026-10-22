import { useEffect, useRef } from 'react'
import UserAvatar from '../common/UserAvatar'
import Icon from '../common/Icon'
import { useAuth } from '../../context/AuthContext'
import { NavLink, Link, useLocation } from 'react-router-dom'
const links = [['/', 'overview', 'Overview'], ['/applications', 'applications', 'Applications'], ['/applications?view=board', 'board', 'Kanban'], ['/companies', 'companies', 'Companies'], ['/statistics', 'chart', 'Statistics'], ['/settings', 'settings', 'Settings']]
export default function Sidebar({ open, close }) {
  const { user, logout } = useAuth()
  const { pathname, search } = useLocation()
  const board = pathname === '/applications' && new URLSearchParams(search).get('view') === 'board'
  const sidebar = useRef(null)
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebar.current?.querySelector('a')?.focus()
    function keyboard(event) {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key !== 'Tab') return
      const items = [...sidebar.current.querySelectorAll('a, button')]
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard) }
  }, [open, close])
  return <><button className={'sidebar-overlay ' + (open ? 'visible' : '')} aria-label="Close navigation" tabIndex={-1} onClick={close} /><aside id="workspace-navigation" className={'sidebar ' + (open ? 'open' : '')} ref={sidebar} aria-label="Workspace navigation">
    <div className="sidebar-brand-row"><Link to="/" className="brand" onClick={close}><span className="brand-icon"><Icon name="arrow" /></span>InternTrack<span className="brand-dot">.</span></Link><button className="sidebar-close" type="button" aria-label="Close sidebar" onClick={close}><Icon name="close" /></button></div>
    <div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation">{links.map(([path, icon, label]) => path.includes('?') ? <Link key={path} className={board ? 'active' : ''} aria-current={board ? 'page' : undefined} to={path} onClick={close}><Icon name={icon} /><span>{label}</span></Link> : <NavLink key={path} to={path} aria-current={path === '/applications' && board ? false : 'page'} end={path === '/' || path === '/applications'} className={({ isActive }) => isActive && !(path === '/applications' && board) ? 'active' : ''} onClick={close}><Icon name={icon} /><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-tip"><span className="sidebar-tip-icon"><Icon name="spark" /></span><h3>Your next chapter starts here.</h3><p>One application. One conversation. One step forward.</p><Link to="/applications/new" onClick={close}>Track an opportunity <Icon name="arrow" /></Link></div>
    <div className="sidebar-bottom"><Link to="/profile" className="sidebar-identity" onClick={close}><UserAvatar user={user} className="avatar" /><span><strong>{user.name}</strong><small>Personal workspace</small></span></Link><button type="button" className="sidebar-logout" aria-label="Sign out of InternTrack" title="Sign out" onClick={logout}><Icon name="logout" /></button></div>
  </aside></>
}
