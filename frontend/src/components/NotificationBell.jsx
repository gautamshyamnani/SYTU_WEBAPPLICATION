// src/components/NotificationBell.jsx
// Bell icon with unread badge + dropdown panel.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()

  if (diff < 60_000)   return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString()
}

function typeIcon(type) {
  switch (type) {
    case 'connection': return '🤝'
    case 'message':    return '💬'
    case 'request':    return '📨'
    default:           return '🔔'
  }
}

function notifRoute(type) {
  switch (type) {
    case 'connection':
    case 'request':    return '/requests'
    case 'message':    return '/chat'
    default:           return null
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationBell({ open, onToggle }) {
  const navigate = useNavigate()
  const panelRef = useRef(null)

  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
  } = useNotifications()

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onToggle(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onToggle])

  const handleClick = async (notif) => {
    if (!notif.read) await markRead(notif._id)
    const route = notifRoute(notif.type)
    if (route) {
      onToggle(false)
      navigate(route)
    }
  }

  return (
    <div className="notif-wrap" ref={panelRef}>
      {/* Bell button */}
      <button
        className={`notif-bell-btn${open ? ' active' : ''}`}
        onClick={() => onToggle(!open)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notif-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="notif-dropdown">
          {/* Header */}
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            {notifications.length > 0 && (
              <button
                className="notif-clear-btn"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="notif-body">
            {loading ? (
              <div className="notif-empty">
                <span className="notif-spinner" />
                <span>Loading…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                <span style={{ fontSize: '1.6rem' }}>🔕</span>
                <span>No notifications</span>
              </div>
            ) : (
              <ul className="notif-list">
                {notifications.map((n) => (
                  <li
                    key={n._id}
                    className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                    onClick={() => handleClick(n)}
                  >
                    <span className="notif-icon">{typeIcon(n.type)}</span>
                    <div className="notif-content">
                      <p className="notif-message">{n.message}</p>
                      <span className="notif-time">{formatTime(n.createdAt)}</span>
                    </div>
                    {!n.read && <span className="notif-dot" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
