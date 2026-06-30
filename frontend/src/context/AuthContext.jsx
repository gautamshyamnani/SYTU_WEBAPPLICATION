// src/context/AuthContext.jsx
// ─── Global auth state ───────────────────────────────────────────────────────
// Provides: { user, token, loading, login, register, logout }
// Persists access token + basic user info in localStorage so a hard refresh
// doesn't log the user out.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(() => localStorage.getItem('accessToken'))
  const [loading, setLoading] = useState(true)

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  // ── Persist helpers ──────────────────────────────────────────────────────
  const persist = (accessToken, userData) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(accessToken)
    setUser(userData)
  }

  const clear = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  // ── Auth actions ─────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const { data } = await authApi.login({ email, password })
    persist(data.accessToken, data.user)
    return data
  }, [])

  const register = useCallback(async ({ name, email, password }) => {
    const { data } = await authApi.register({ name, email, password })
    persist(data.accessToken, data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* backend best-effort */ }
    clear()
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
