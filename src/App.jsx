import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import ApplicationProvider from './context/ApplicationProvider'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import AddApplication from './pages/AddApplication'
import ApplicationDetails from './pages/ApplicationDetails'
import EditApplication from './pages/EditApplication'
import Companies from './pages/Companies'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'
export default function App() {
  return <BrowserRouter><ApplicationProvider><Routes>
    <Route element={<Layout />}>
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
  </Routes></ApplicationProvider></BrowserRouter>
}
