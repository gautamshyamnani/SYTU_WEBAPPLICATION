// src/pages/RequestsPage.jsx
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { connectionApi } from '../services/api'

export default function RequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  // map of requestId → 'accepting' | 'rejecting' | 'accepted' | 'rejected'
  const [actions, setActions]   = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        const res = await connectionApi.requests()
        setRequests(res.data.requests ?? res.data)
      } catch {
        setError('Failed to load connection requests.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleAccept = async (requestId) => {
    setActions((prev) => ({ ...prev, [requestId]: 'accepting' }))
    try {
      await connectionApi.accept(requestId)
      setActions((prev) => ({ ...prev, [requestId]: 'accepted' }))
      // Remove from list after short delay
      setTimeout(() => {
        setRequests((prev) => prev.filter((r) => r._id !== requestId))
        setActions((prev) => { const n = { ...prev }; delete n[requestId]; return n })
      }, 1200)
    } catch {
      setActions((prev) => ({ ...prev, [requestId]: 'error-accept' }))
      setTimeout(() => setActions((prev) => ({ ...prev, [requestId]: undefined })), 2000)
    }
  }

  const handleReject = async (requestId) => {
    setActions((prev) => ({ ...prev, [requestId]: 'rejecting' }))
    try {
      await connectionApi.reject(requestId)
      setActions((prev) => ({ ...prev, [requestId]: 'rejected' }))
      setTimeout(() => {
        setRequests((prev) => prev.filter((r) => r._id !== requestId))
        setActions((prev) => { const n = { ...prev }; delete n[requestId]; return n })
      }, 1200)
    } catch {
      setActions((prev) => ({ ...prev, [requestId]: 'error-reject' }))
      setTimeout(() => setActions((prev) => ({ ...prev, [requestId]: undefined })), 2000)
    }
  }

  const getSender = (req) => req.sender ?? req.from ?? req

  return (
    <div className="page-shell">
      <Navbar />
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">Connection Requests</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${requests.length} pending request${requests.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="requests-list">
            {[1, 2, 3].map((n) => (
              <div key={n} className="request-card skeleton-card" style={{ minHeight: 80 }} />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No pending requests right now.</p>
          </div>
        ) : (
          <div className="requests-list">
            {requests.map((req) => {
              const sender  = getSender(req)
              const action  = actions[req._id]
              const busy    = action === 'accepting' || action === 'rejecting'

              return (
                <div key={req._id} className="request-card">
                  <div className="request-card-info">
                    <div className="avatar" style={{ width: 44, height: 44, fontSize: '1rem', flexShrink: 0 }}>
                      {sender.name
                        ? sender.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                        : sender.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <div className="user-card-name">{sender.name || sender.username}</div>
                      {sender.bio && (
                        <div className="user-card-username" style={{ marginTop: 2 }}>
                          {sender.bio.length > 80 ? sender.bio.slice(0, 80) + '…' : sender.bio}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="request-card-actions">
                    {action === 'accepted' && (
                      <span className="feedback-badge feedback-badge--success">✓ Accepted</span>
                    )}
                    {action === 'rejected' && (
                      <span className="feedback-badge feedback-badge--danger">✕ Rejected</span>
                    )}
                    {(action === 'error-accept' || action === 'error-reject') && (
                      <span className="feedback-badge feedback-badge--danger">Something went wrong</span>
                    )}
                    {!action && (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleAccept(req._id)}
                          disabled={busy}
                        >
                          {action === 'accepting' ? 'Accepting…' : 'Accept'}
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleReject(req._id)}
                          disabled={busy}
                          style={{ color: 'var(--danger)' }}
                        >
                          {action === 'rejecting' ? 'Rejecting…' : 'Reject'}
                        </button>
                      </>
                    )}
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
