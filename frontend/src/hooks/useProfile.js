// src/hooks/useProfile.js
// Thin hook that manages profile fetch + update state so the page stays clean.

import { useState, useEffect, useCallback } from 'react'
import { userApi } from '../services/api'

export function useProfile() {
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [feedback, setFeedback] = useState({ type: '', msg: '' })

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await userApi.getMe()
      // Backend wraps the user in data.user or returns it directly
      setProfile(data.user ?? data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // ── Update ─────────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (payload) => {
    setFeedback({ type: '', msg: '' })
    try {
      const { data } = await userApi.update(payload)
      setProfile(data.user ?? data)
      setFeedback({ type: 'success', msg: 'Profile updated.' })
      return { ok: true }
    } catch (err) {
      const msg = err.response?.data?.message || 'Update failed. Please try again.'
      setFeedback({ type: 'error', msg })
      return { ok: false, msg }
    }
  }, [])

  const clearFeedback = () => setFeedback({ type: '', msg: '' })

  return { profile, loading, error, feedback, fetchProfile, updateProfile, clearFeedback }
}
