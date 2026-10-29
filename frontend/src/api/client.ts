import axios from 'axios'
import toast from 'react-hot-toast'
import i18n from '@/i18n'
import { log } from '@/utils/logger'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({ baseURL: BASE_URL })

declare module 'axios' {
  interface AxiosRequestConfig {
    // A request other than GET that only reads data and may be sent again
    retryable?: boolean
  }
}

// Reads are sent again up to 3 times, after 1-2, 2-4 and 4-8 s, when the connection drops or the proxy answers 502 or 503
const RETRY_ATTEMPTS = 3
const RETRY_STATUSES = new Set([502, 503])
const RETRY_METHODS = new Set(['get', 'head', 'options'])

function retryDelayMs(attempt: number) {
  const delay = Math.min(1000 * 2 ** attempt, 10000)
  return delay + Math.random() * delay
}

// Request: attach access token, request ID, and log
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Generate short request ID for correlation with backend logs
  const reqId = Math.random().toString(36).substring(2, 10)
  config.headers['X-Request-Id'] = reqId
  log.api(`${config.method?.toUpperCase()} ${config.url}`, { reqId, params: config.params, dataKeys: config.data ? Object.keys(config.data) : undefined })
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
    const attempt: number = original?._retryCount ?? 0
    const retry = !!original && attempt < RETRY_ATTEMPTS
      && (RETRY_METHODS.has(original.method ?? 'get') || original.retryable === true)
      && (error.response ? RETRY_STATUSES.has(status) : error.code === 'ERR_NETWORK')
    log.error(`API ${error.config?.method?.toUpperCase()} ${error.config?.url}`, { reqId: error.config?.headers?.['X-Request-Id'], status: error.response?.status, message: error.response?.data?.message || error.message, ...(retry ? { retry: attempt + 1 } : {}) })
    if (retry) {
      original._retryCount = attempt + 1
      await new Promise(resolve => setTimeout(resolve, retryDelayMs(attempt)))
      return api(original)
    }
    return Promise.reject(error)
  }
)

export default api
export { SESSION_EXPIRED }
