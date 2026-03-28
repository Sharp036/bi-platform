import axios from 'axios'
import toast from 'react-hot-toast'
import i18n from '@/i18n'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({ baseURL: BASE_URL })

// Request: attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Guard against multiple concurrent 401/403 handlers triggering logout simultaneously
let isLoggingOut = false

// Sentinel error: callers' catch blocks can check this to suppress duplicate toasts
const SESSION_EXPIRED = new Error('SESSION_EXPIRED')

function handleSessionExpired() {
  if (isLoggingOut) return Promise.reject(SESSION_EXPIRED)
  isLoggingOut = true
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  toast.error(i18n.t('auth.session_expired'), { id: 'session-expired', duration: 5000 })
  setTimeout(() => {
    import('@/store/authStore').then(({ useAuthStore }) => {
      useAuthStore.getState().logout()
    })
    window.location.href = '/login'
    isLoggingOut = false
  }, 1500)
  return Promise.reject(SESSION_EXPIRED)
}

// Response: auto-refresh on 401/403, then redirect to login
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    if ((status === 401 || status === 403) && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          return handleSessionExpired()
        }
      } else {
        return handleSessionExpired()
      }
    }
    return Promise.reject(error)
  }
)

export default api
export { SESSION_EXPIRED }
