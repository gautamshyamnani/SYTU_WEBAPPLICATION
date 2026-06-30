// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }    from './context/AuthContext'
import ProtectedRoute      from './components/ProtectedRoute'
import LoginPage           from './pages/LoginPage'
import RegisterPage        from './pages/RegisterPage'
import DashboardPage       from './pages/DashboardPage'
import ProfilePage         from './pages/ProfilePage'
import UsersPage           from './pages/UsersPage'
import RequestsPage        from './pages/RequestsPage'
import ConnectionsPage     from './pages/ConnectionsPage'
import ChatPage            from './pages/ChatPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected */}
          <Route path="/dashboard"   element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile"     element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/users"       element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/requests"    element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
          <Route path="/connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />
          <Route path="/chat"        element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
