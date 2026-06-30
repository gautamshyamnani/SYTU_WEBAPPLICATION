// src/services/socket.js
// ─── Singleton socket.io-client connection ───────────────────────────────────
// Connects to the same backend host the REST API uses, authenticated with the
// stored access token. One connection is shared across the app so switching
// pages doesn't reconnect/disconnect unnecessarily.

import { io } from 'socket.io-client'

// VITE_API_URL is typically something like http://localhost:5000/api —
// the socket server lives at the host root, so strip a trailing /api.
const API_URL = import.meta.env.VITE_API_URL || '/api'
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '') || '/'

let socket = null

export function getSocket() {
  if (socket) return socket

  const token = localStorage.getItem('accessToken')

  socket = io(SOCKET_URL, {
    withCredentials: true,
    auth: { token },
    autoConnect: false,
  })

  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
