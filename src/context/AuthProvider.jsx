import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthContext } from './AuthContext'
import * as service from '../services/authService'
import { readStoredToken, storeToken, removeStoredToken, setAccessToken, onUnauthorized } from '../services/authSession'

const signedOut = { user: null, accessToken: null, isAuthLoading: false }
export default function AuthProvider({ children }) {
  const [session, setSession] = useState({ ...signedOut, isAuthLoading: true })
  const version = useRef(0)
  const nextVersion = useCallback(() => ++version.current, [])

  const logout = useCallback(() => {
    nextVersion()
    removeStoredToken()
    setAccessToken(null)
    setSession(signedOut)
  }, [nextVersion])

  useEffect(() => {
    const attempt = nextVersion()
    const unsubscribe = onUnauthorized(logout)
    async function restore() {
      const token = readStoredToken()
      try {
        const result = token ? await service.getCurrentUser(token) : null
        if (attempt !== version.current) return
        setAccessToken(token)
        setSession(result ? { user: result.user, accessToken: token, isAuthLoading: false } : signedOut)
      } catch {
        if (attempt !== version.current) return
        removeStoredToken()
        setAccessToken(null)
        setSession(signedOut)
      }
    }
    restore()
    return () => { nextVersion(); unsubscribe(); setAccessToken(null) }
  }, [logout, nextVersion])

  async function login(credentials) {
    const attempt = nextVersion()
    const result = await service.login(credentials)
    if (attempt !== version.current) throw new Error('Sign in was cancelled. Please try again.')
    storeToken(result.accessToken)
    setAccessToken(result.accessToken)
    setSession({ user: result.user, accessToken: result.accessToken, isAuthLoading: false })
  }

  async function updateProfile(updates) {
    const attempt = version.current
    const token = session.accessToken
    if (!token || !session.user) throw new Error('Please sign in again.')
    const result = await service.updateProfile(token, updates)
    if (attempt !== version.current) throw new Error('Profile update was cancelled. Please sign in again.')
    setSession(current => current.accessToken === token ? { ...current, user: result.user } : current)
    return result.user
  }

  async function deleteAccount(currentPassword) {
    const attempt = version.current
    const token = session.accessToken
    if (!token || !session.user) throw new Error('Please sign in again.')
    const result = await service.deleteAccount(token, currentPassword)
    // A late response for a deleted older account must not sign out a newer login.
    if (attempt === version.current) logout()
    return result
  }

  const refreshCurrentUser = useCallback(async () => {
    const attempt = version.current
    const token = session.accessToken
    if (!token) return
    const result = await service.getCurrentUser(token)
    if (attempt !== version.current) return
    setSession(current => current.accessToken === token ? { ...current, user: result.user } : current)
    return result.user
  }, [session.accessToken])

  return <AuthContext.Provider value={{ ...session, isAuthenticated: Boolean(session.user && session.accessToken), login, logout, updateProfile, refreshCurrentUser, deleteAccount }}>{children}</AuthContext.Provider>
}
