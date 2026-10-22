import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useApplications } from '../../context/ApplicationContext'
export default function Layout() {
  const [open, setOpen] = useState(false)
  const closeNavigation = useCallback(() => { setOpen(false); document.getElementById('navigation-toggle')?.focus() }, [])
  const { error, loading, loaded, pending, reloadApplications } = useApplications()
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><Sidebar open={open} close={closeNavigation} /><div className="main-shell"><Navbar open={open} toggle={() => setOpen(!open)} /><main id="main-content" tabIndex={-1}>{error && <div className="notice error" role="alert">{error} <button className="button secondary" disabled={loading || pending} onClick={reloadApplications}>Retry loading</button></div>}{loading ? <div className="notice" role="status">Loading applications...</div> : loaded ? <Outlet /> : null}{pending && <div role="status">Saving changes...</div>}</main><footer>A little progress, every day.<span>InternTrack · Your personal career companion</span></footer></div></div>
}
