import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApplications } from '../../context/ApplicationContext'
import { exportApplicationData } from '../../utils/exportData'
export default function Navbar({ toggle, open }) {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const { applications } = useApplications()
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const workspaceRef = useRef(null)
  const triggerRef = useRef(null)
  const settingsRef = useRef(null)
  const dropdownId = useId()
  useEffect(() => {
    if (!workspaceOpen) return
    settingsRef.current?.focus()
    function closeOutside(event) {
      if (!workspaceRef.current?.contains(event.target)) setWorkspaceOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setWorkspaceOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [workspaceOpen])
  function closeWorkspace() {
    setWorkspaceOpen(false)
    triggerRef.current?.focus()
  }
  const section = pathname === '/' ? 'Dashboard' : pathname.startsWith('/applications') ? 'Applications' : pathname.slice(1)
  return <header className="navbar"><div className="breadcrumb"><button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={toggle}>?</button><span>Workspace</span><span>/</span><strong>{section}</strong></div><div className="header-right"><span className="local-label"><span className="online-dot" /> Saved on this device</span><div className="workspace-dropdown" ref={workspaceRef} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setWorkspaceOpen(false)
  }}><button type="button" className="avatar small" ref={triggerRef} aria-label="Student Workspace" aria-expanded={workspaceOpen} aria-controls={dropdownId} onClick={() => setWorkspaceOpen(!workspaceOpen)}>S</button>{workspaceOpen && <div className="workspace-menu" id={dropdownId}><div className="workspace-menu-heading">Student Workspace</div><Link ref={settingsRef} to="/settings" onClick={closeWorkspace}>Settings</Link><button type="button" onClick={() => {
    exportApplicationData(applications)
    closeWorkspace()
  }}>Export Data</button><button type="button" onClick={logout}>Sign out</button></div>}</div></div></header>
}
