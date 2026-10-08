import { useLocation } from 'react-router-dom'
export default function Navbar({ toggle, open }) {
  const { pathname } = useLocation()
  const section = pathname === '/' ? 'Dashboard' : pathname.startsWith('/applications') ? 'Applications' : pathname.slice(1)
  return <header className="navbar"><div className="breadcrumb"><button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={toggle}>?</button><span>Workspace</span><span>/</span><strong>{section}</strong></div><div className="header-right"><span className="local-label"><span className="online-dot" /> Saved on this device</span><span className="avatar small">S</span></div></header>
}
