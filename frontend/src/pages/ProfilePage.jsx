// src/pages/ProfilePage.jsx
import { useState, useEffect }   from 'react'
import Navbar                    from '../components/Navbar'
import { useProfile }            from '../hooks/useProfile'

// ── Helpers ────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

function skillArray(raw) {
  // Backend may store skills as array or comma-string
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

// ── View card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile, onEdit }) {
  const skills = skillArray(profile.skills)
  const hasAvatar = !!profile.profilePicture

  return (
    <div className="profile-card">
      {/* Avatar area */}
      <div className="profile-avatar-wrap">
        {hasAvatar ? (
          <img
            src={profile.profilePicture}
            alt={profile.name}
            className="profile-avatar-img"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="profile-avatar-fallback">{initials(profile.name)}</div>
        )}
      </div>

      {/* Name + meta */}
      <div className="profile-info">
        <h2 className="profile-name">{profile.name || '—'}</h2>

        {profile.username && (
          <p className="profile-username">@{profile.username}</p>
        )}

        {profile.location && (
          <p className="profile-meta">📍 {profile.location}</p>
        )}

        <p className="profile-meta" style={{ color: 'var(--text-muted)' }}>
          ✉ {profile.email}
        </p>

        {profile.bio && (
          <p className="profile-bio">{profile.bio}</p>
        )}

        {skills.length > 0 && (
          <div className="skills-wrap">
            {skills.map((s) => (
              <span key={s} className="skill-tag">{s}</span>
            ))}
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: 'auto', padding: '0.6rem 1.4rem' }} onClick={onEdit}>
          Edit profile
        </button>
      </div>
    </div>
  )
}

// ── Edit form ──────────────────────────────────────────────────────────────
function EditForm({ profile, onSave, onCancel, feedback, clearFeedback }) {
  const [form, setForm] = useState({
    username:       profile.username       || '',
    bio:            profile.bio            || '',
    skills:         skillArray(profile.skills).join(', '),
    location:       profile.location       || '',
    profilePicture: profile.profilePicture || '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    clearFeedback()
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    // Normalise skills to an array before sending
    const payload = {
      ...form,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
    }
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="profile-card">
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Edit profile
      </h2>

      {feedback.msg && (
        <div className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} role="alert">
          <span>{feedback.type === 'success' ? '✓' : '⚠'}</span> {feedback.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="ada_lovelace"
              value={form.username}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="San Francisco, CA"
              value={form.location}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            placeholder="Tell other developers about yourself…"
            value={form.bio}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="skills">Skills <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(comma-separated)</span></label>
          <input
            id="skills"
            name="skills"
            type="text"
            placeholder="React, Node.js, TypeScript"
            value={form.skills}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="profilePicture">Profile picture URL</label>
          <input
            id="profilePicture"
            name="profilePicture"
            type="url"
            placeholder="https://example.com/avatar.jpg"
            value={form.profilePicture}
            onChange={handleChange}
          />
        </div>

        {/* Preview */}
        {form.profilePicture && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Preview</p>
            <img
              src={form.profilePicture}
              alt="preview"
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { profile, loading, error, feedback, updateProfile, clearFeedback } = useProfile()
  const [editMode, setEditMode] = useState(false)

  const handleSave = async (payload) => {
    const result = await updateProfile(payload)
    if (result.ok) setEditMode(false)
  }

  // ── Loading skeleton ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="dashboard-shell">
        <Navbar />
        <main className="dashboard-main">
          <div className="skeleton-card">
            <div className="skeleton skeleton-avatar" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-line" style={{ width: '40%', marginBottom: '0.75rem' }} />
              <div className="skeleton skeleton-line" style={{ width: '60%', marginBottom: '0.5rem' }} />
              <div className="skeleton skeleton-line" style={{ width: '80%' }} />
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="dashboard-shell">
        <Navbar />
        <main className="dashboard-main">
          <div className="alert alert-error"><span>⚠</span> {error}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-shell">
      <Navbar />
      <main className="dashboard-main">
        <div className="page-header">
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">How other developers see you on DevLink.</p>
        </div>

        {editMode ? (
          <EditForm
            profile={profile}
            onSave={handleSave}
            onCancel={() => { setEditMode(false); clearFeedback() }}
            feedback={feedback}
            clearFeedback={clearFeedback}
          />
        ) : (
          <>
            {feedback.msg && (
              <div className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} role="alert" style={{ marginBottom: '1rem' }}>
                <span>{feedback.type === 'success' ? '✓' : '⚠'}</span> {feedback.msg}
              </div>
            )}
            <ProfileCard profile={profile} onEdit={() => setEditMode(true)} />
          </>
        )}
      </main>
    </div>
  )
}
