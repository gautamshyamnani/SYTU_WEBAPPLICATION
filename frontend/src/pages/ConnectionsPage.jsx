// src/pages/ConnectionsPage.jsx
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { connectionApi } from '../services/api'

export default function ConnectionsPage() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await connectionApi.list()
        setConnections(res.data.connections ?? res.data)
      } catch {
        setError('Failed to load connections.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="page-shell">
      <Navbar />
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">My Connections</h1>
          <p className="page-subtitle">
            {loading
              ? 'Loading…'
              : `${connections.length} connection${connections.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="users-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="user-card skeleton-card" style={{ minHeight: 160 }} />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤝</div>
            <p>No connections yet. Head to <strong>Users</strong> to start connecting!</p>
          </div>
        ) : (
          <div className="users-grid">
            {connections.map((conn) => {
              // Backend may return the full user object directly, or nested
              const user = conn.user ?? conn.connectedUser ?? conn
              return (
                <div key={conn._id ?? user._id} className="user-card">
                  <div className="user-card-header">
                    <div className="avatar" style={{ width: 44, height: 44, fontSize: '1rem' }}>
                      {user.name
                        ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                        : user.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <div className="user-card-name">{user.name || user.username}</div>
                      {user.username && user.name && (
                        <div className="user-card-username">@{user.username}</div>
                      )}
                    </div>
                  </div>

                  {user.bio && (
                    <p className="user-card-bio">{user.bio}</p>
                  )}

                  {user.skills?.length > 0 && (
                    <div className="skills-wrap">
                      {user.skills.slice(0, 5).map((skill) => (
                        <span key={skill} className="skill-chip">{skill}</span>
                      ))}
                      {user.skills.length > 5 && (
                        <span className="skill-chip skill-chip--more">+{user.skills.length - 5}</span>
                      )}
                    </div>
                  )}

                  <div className="user-card-footer">
                    <span className="feedback-badge feedback-badge--success" style={{ fontSize: '0.75rem' }}>
                      ✓ Connected
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
