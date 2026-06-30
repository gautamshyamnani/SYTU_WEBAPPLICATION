// src/components/Navbar.jsx
import { useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const NAV_LINKS = [
  { to: '/dashboard',   label: 'Dashboard' },
  { to: '/users',       label: 'Users' },
  { to: '/requests',    label: 'Requests' },
  { to: '/connections', label: 'Connections' },
  { to: '/chat',        label: 'Chat' },
  { to: '/profile',     label: 'Profile' },
]

export default function Navbar() {
  const { user, logout }  = useAuth()
  const navigate          = useNavigate()
  const { pathname }      = useLocation()
  const [busy, setBusy]       = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const handleNotifToggle = useCallback((val) => setNotifOpen(val), [])

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const handleLogout = async () => {
    setBusy(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar">
      {/* Brand */}
      <Link to="/dashboard" className="brand" style={{ textDecoration: 'none' }}>
        <div className="brand-dot">⚡</div>
        <span className="brand-name">DevLink</span>
      </Link>

      {/* Nav links */}
      <nav className="nav-links">
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`nav-link ${pathname === to ? 'active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Right side — bell + avatar + logout */}
      <div className="topbar-actions">
        <NotificationBell open={notifOpen} onToggle={handleNotifToggle} />
        <Link to="/profile" title="View profile">
          {user?.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.name}
              className="avatar avatar-img"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="avatar">{initials}</div>
          )}
        </Link>
        <button className="btn btn-ghost" onClick={handleLogout} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  )
}
