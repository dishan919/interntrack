import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ApplicationProvider from '../../context/ApplicationProvider'
import Layout from './Layout'

export default function AuthenticatedWorkspace() {
  const { isAuthLoading, isAuthenticated } = useAuth()
  if (isAuthLoading) return <main className="register-page" role="status">Checking your session...</main>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <ApplicationProvider><Layout /></ApplicationProvider>
}
