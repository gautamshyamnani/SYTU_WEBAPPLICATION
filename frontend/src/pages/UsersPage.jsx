// src/pages/UsersPage.jsx
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { userApi, connectionApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  // map of userId → 'pending' | 'connected' | 'sent'
  const [statuses, setStatuses] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        const res = await userApi.getAll()
        // Filter out current user
        const others = (res.data.users ?? res.data).filter(
          (u) => u._id !== me?._id
        )
        setUsers(others)
      } catch {
        setError('Failed to load users. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [me?._id])

  const handleConnect = async (userId) => {
    setStatuses((prev) => ({ ...prev, [userId]: 'loading' }))
    try {
      await connectionApi.send(userId)
      setStatuses((prev) => ({ ...prev, [userId]: 'pending' }))
    } catch (err) {
      const msg = err.response?.data?.message || ''
      // Already connected or request already sent
      if (msg.toLowerCase().includes('already')) {
        setStatuses((prev) => ({ ...prev, [userId]: 'pending' }))
      } else {
        setStatuses((prev) => ({ ...prev, [userId]: 'error' }))
        setTimeout(() => {
          setStatuses((prev) => ({ ...prev, [userId]: undefined }))
        }, 2000)
      }
    }
  }

  const ConnectButton = ({ userId }) => {
    const status = statuses[userId]
    if (status === 'pending') {
      return (
        <button className="btn btn-ghost" disabled style={{ opacity: 0.7 }}>
          ⏳ Pending
        </button>
      )
    }
    if (status === 'loading') {
      return (
        <button className="btn btn-primary" disabled>
          Sending…
        </button>
      )
    }
    if (status === 'error') {
      return (
        <button className="btn btn-danger" disabled>
          Failed
        </button>
      )
    }
    return (
      <button className="btn btn-primary" onClick={() => handleConnect(userId)}>
        + Connect
      </button>
    )
  }

  return (
    <div className="page-shell">
      <Navbar />
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">Developers</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${users.length} developer${users.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="users-grid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="user-card skeleton-card" style={{ minHeight: 180 }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>No other developers yet.</p>
          </div>
        ) : (
          <div className="users-grid">
            {users.map((u) => (
              <div key={u._id} className="user-card">
                <div className="user-card-header">
                  <div className="avatar" style={{ width: 44, height: 44, fontSize: '1rem' }}>
                    {u.name
                      ? u.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                      : u.username?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div className="user-card-name">{u.name || u.username}</div>
                    {u.username && u.name && (
                      <div className="user-card-username">@{u.username}</div>
                    )}
                  </div>
                </div>

                {u.bio && (
                  <p className="user-card-bio">{u.bio}</p>
                )}

                {u.skills?.length > 0 && (
                  <div className="skills-wrap">
                    {u.skills.slice(0, 5).map((skill) => (
                      <span key={skill} className="skill-chip">{skill}</span>
                    ))}
                    {u.skills.length > 5 && (
                      <span className="skill-chip skill-chip--more">+{u.skills.length - 5}</span>
                    )}
                  </div>
                )}

                <div className="user-card-footer">
                  <ConnectButton userId={u._id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
