// src/services/api.js
import axios from 'axios'

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let pendingQueue = []

const processQueue = (error, token = null) => {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const data = error.response?.data

    if (
      error.response?.status === 401 &&
      data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`
            return api(original)
          })
          .catch(Promise.reject.bind(Promise))
      }

      isRefreshing = true

      try {
        const { data: refreshData } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const newToken = refreshData.accessToken
        localStorage.setItem('accessToken', newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ── Auth API helpers ──────────────────────────────────────────────────────
export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login:    (payload) => api.post('/auth/login', payload),
  logout:   ()        => api.post('/auth/logout'),
  refresh:  ()        => api.post('/auth/refresh'),
}

// ── User / profile API helpers ────────────────────────────────────────────
export const userApi = {
  getMe:   ()        => api.get('/user/me'),
  update:  (payload) => api.put('/user/update', payload),
  getAll:  ()        => api.get('/user/all'),
}

// ── Connection API helpers ────────────────────────────────────────────────
export const connectionApi = {
  send:     (userId)     => api.post(`/connection/send/${userId}`),
  requests: ()           => api.get('/connection/requests'),
  accept:   (requestId)  => api.post(`/connection/accept/${requestId}`),
  reject:   (requestId)  => api.post(`/connection/reject/${requestId}`),
  list:     ()           => api.get('/connection/list'),
}

// ── Chat API helpers ───────────────────────────────────────────────────────
export const chatApi = {
  conversations: ()              => api.get('/chat/conversations'),
  messages:      (userId)        => api.get(`/chat/messages/${userId}`),
  send:          (userId, text)  => api.post(`/chat/send/${userId}`, { text }),
}

// ── Notification API helpers ───────────────────────────────────────────────
export const notificationApi = {
  getAll:     ()   => api.get('/notifications'),
  markRead:   (id) => api.put(`/notifications/read/${id}`),
  markAllRead: ()  => api.put('/notifications/read-all'),
}

export default api
