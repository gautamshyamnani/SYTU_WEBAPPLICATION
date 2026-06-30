// src/components/ProtectedRoute.jsx
// Redirects unauthenticated visitors to /login, shows a spinner while loading.

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}
