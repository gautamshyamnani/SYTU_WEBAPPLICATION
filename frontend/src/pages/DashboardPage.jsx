// src/pages/DashboardPage.jsx
import { Link }    from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar      from '../components/Navbar'

export default function DashboardPage() {
  const { user } = useAuth()

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="dashboard-shell">
      <Navbar />

      <main className="dashboard-main">
        {/* Welcome banner */}
        <div className="welcome-banner">
          <h2>Welcome back, {user?.name?.split(' ')[0] ?? 'Developer'} 👋</h2>
          <p>Your DevLink profile is live. Build your network — connections and chat coming next.</p>
          <Link to="/profile" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: '1.25rem', width: 'auto', padding: '0.6rem 1.4rem' }}>
            View profile →
          </Link>
        </div>

        {/* Quick-stat cards */}
        <div className="stats-row">
          <div className="stat-card accent">
            <div className="stat-label">Account status</div>
            <div className="stat-value">{user?.isPremium ? 'Premium ✦' : 'Free'}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Member since</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{joinedDate}</div>
          </div>

          <div className="stat-card success">
            <div className="stat-label">Auth</div>
            <div className="stat-value">✓ Active</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="quick-actions">
          <h3 className="section-title">Quick actions</h3>
          <div className="actions-grid">
            <Link to="/profile" className="action-card">
              <div className="action-icon">👤</div>
              <div>
                <div className="action-label">Edit profile</div>
                <div className="action-desc">Update your bio, skills, and picture</div>
              </div>
            </Link>
            <div className="action-card action-card--dim">
              <div className="action-icon">🔗</div>
              <div>
                <div className="action-label">Connections</div>
                <div className="action-desc">Coming in Slice 3</div>
              </div>
            </div>
            <div className="action-card action-card--dim">
              <div className="action-icon">💬</div>
              <div>
                <div className="action-label">Messages</div>
                <div className="action-desc">Coming in Slice 4</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
