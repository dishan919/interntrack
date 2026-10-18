import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import AuthProvider from './context/AuthProvider'
import AuthenticatedWorkspace from './components/layout/AuthenticatedWorkspace'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import AddApplication from './pages/AddApplication'
import ApplicationDetails from './pages/ApplicationDetails'
import EditApplication from './pages/EditApplication'
import Companies from './pages/Companies'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'
import Register from './pages/Register'
import Login from './pages/Login'
export default function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><AuthProvider><Routes>
    <Route path="login" element={<Login />} />
    <Route path="register" element={<Register />} />
    <Route element={<AuthenticatedWorkspace />}>
      <Route index element={<Dashboard />} />
      <Route path="applications" element={<Applications />} />
      <Route path="applications/new" element={<AddApplication />} />
      <Route path="applications/:id" element={<ApplicationDetails />} />
      <Route path="applications/:id/edit" element={<EditApplication />} />
      <Route path="companies" element={<Companies />} />
      <Route path="statistics" element={<Statistics />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<div className="empty-state"><h1>Page not found</h1><Link className="button primary" to="/">Back to dashboard</Link></div>} />
    </Route>
  </Routes></AuthProvider></BrowserRouter>
}
