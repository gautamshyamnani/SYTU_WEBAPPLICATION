// src/hooks/useNotifications.js
// Manages fetching, real-time updates, and read/clear logic for notifications.

import { useState, useEffect, useCallback } from 'react'
import { notificationApi } from '../services/api'
import { connectSocket } from '../services/socket'
import { useAuth } from '../context/AuthContext'

export function useNotifications() {
  const { user: me } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  // Derived: count of unread
  const unreadCount = notifications.filter((n) => !n.read).length

  // ── Fetch all notifications ───────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await notificationApi.getAll()
      setNotifications(data.notifications ?? data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (me?._id) fetchNotifications()
  }, [me?._id, fetchNotifications])

  // ── Real-time: listen for "newNotification" from socket ───────────────────
  useEffect(() => {
    if (!me?._id) return

    const socket = connectSocket()

    const handleNew = (notification) => {
      setNotifications((prev) => [notification, ...prev])
    }

    socket.on('newNotification', handleNew)
    return () => socket.off('newNotification', handleNew)
  }, [me?._id])

  // ── Mark single notification as read ─────────────────────────────────────
  const markRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    )
    try {
      await notificationApi.markRead(id)
    } catch {
      // Roll back on failure
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: false } : n))
      )
    }
  }, [])

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await notificationApi.markAllRead()
    } catch {
      // Re-fetch to get true state
      fetchNotifications()
    }
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
  }
}
