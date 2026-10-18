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

  return <AuthContext.Provider value={{ ...session, isAuthenticated: Boolean(session.user && session.accessToken), login, logout }}>{children}</AuthContext.Provider>
}
