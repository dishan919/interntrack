import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useApplications } from '../../context/ApplicationContext'
export default function Layout() {
  const [open, setOpen] = useState(false)
  const { storageError } = useApplications()
  return <div className="app-shell"><Sidebar open={open} close={() => setOpen(false)} /><div className="main-shell"><Navbar open={open} toggle={() => setOpen(!open)} /><main>{storageError && <div className="notice error" role="alert">{storageError}</div>}<Outlet /></main><footer>Made for your next move.<span>InternTrack � Your personal career companion</span></footer></div></div>
}
