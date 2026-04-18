/**
 * Centralized frontend logger with categories, levels, and localStorage persistence.
 *
 * Usage:
 *   import { log } from '@/utils/logger'
 *   log.save('clientIdToServerId', mapping)
 *   log.action('DRILL_REPLACE triggered', { sourceWidgetId, targetWidgetIds })
 *   log.filter('cascade reload', { paramName, prevValue, newOptions })
 *   log.error('Failed to render', error)
 *
 * Enable/disable:
 *   localStorage.setItem('debug', 'all')        -- all categories
 *   localStorage.setItem('debug', 'save,action') -- specific categories
 *   localStorage.removeItem('debug')             -- disable (errors still logged)
 *   URL: ?debug=all or ?debug=save,filter
 *
 * Read logs:
 *   copy(localStorage.getItem('app_logs'))  -- copy full log to clipboard
 *   window.__datorio_logs()                 -- pretty print in console
 */

type LogCategory = 'save' | 'render' | 'action' | 'filter' | 'api' | 'auth' | 'store' | 'error'

interface LogEntry {
  ts: string
  cat: LogCategory
  msg: string
  data?: unknown
}

const MAX_ENTRIES = 300
const STORAGE_KEY = 'app_logs'
const DEBUG_KEY = 'debug'

/** Roles for which detailed logging is enabled.
 *  Users without any of these roles only get error logging.
 *  Edit this list to add/remove debug roles. */
const DEBUG_ROLES: string[] = ['ADMIN']

function isDebugUser(): boolean {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) return true // before login, allow logging
    const payload = token.split('.')[1]
    if (!payload) return false
    // base64url -> base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64))
    const roles: string[] = json.roles || []
    return roles.some(r => DEBUG_ROLES.includes(r))
  } catch {
    return true
  }
}

function getEnabledCategories(): Set<string> | 'all' | null {
  // Check URL param first
  try {
    const url = new URL(window.location.href)
    const debugParam = url.searchParams.get('debug')
    if (debugParam) {
      localStorage.setItem(DEBUG_KEY, debugParam)
      // Remove from URL to avoid persisting in bookmarks
      url.searchParams.delete('debug')
      window.history.replaceState({}, '', url.toString())
      return debugParam === 'all' ? 'all' : new Set(debugParam.split(','))
    }
  } catch { /* ignore */ }

  const stored = localStorage.getItem(DEBUG_KEY)
  if (!stored) return 'all'  // Default: all logging enabled during development
  if (stored === 'off') return null
  if (stored === 'all') return 'all'
  return new Set(stored.split(','))
}

function readEntries(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeEntries(entries: LogEntry[]) {
  try {
    // Keep only last MAX_ENTRIES
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch { /* quota exceeded -- clear and retry */
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-50)))
    } catch { /* give up */ }
  }
}

function appendEntry(cat: LogCategory, msg: string, data?: unknown) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    cat,
    msg,
    data: data !== undefined ? sanitize(data) : undefined,
  }
  const entries = readEntries()
  entries.push(entry)
  writeEntries(entries)
}

// Sanitize data for JSON storage -- handle circular refs, functions, DOM nodes
function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[max depth]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'function') return '[function]'
  if (typeof obj === 'symbol') return obj.toString()
  if (obj instanceof Error) return { name: obj.name, message: obj.message, stack: obj.stack?.split('\n').slice(0, 5).join('\n') }
  if (obj instanceof HTMLElement) return `[${obj.tagName}]`
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj
  if (Array.isArray(obj)) return obj.slice(0, 100).map(item => sanitize(item, depth + 1))
  if (obj instanceof Map) return Object.fromEntries([...obj.entries()].map(([k, v]) => [String(k), sanitize(v, depth + 1)]))
  if (obj instanceof Set) return [...obj].slice(0, 100).map(item => sanitize(item, depth + 1))
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitize(val, depth + 1)
    }
    return result
  }
  return String(obj)
}

function createCategoryLogger(cat: LogCategory) {
  return (msg: string, data?: unknown) => {
    const isError = cat === 'error'

    // Non-debug users: only log errors
    if (!isError && !isDebugUser()) return

    const enabled = getEnabledCategories()

    // Always persist errors, persist others only if enabled
    if (isError || enabled === 'all' || (enabled && enabled.has(cat))) {
      appendEntry(cat, msg, data)
    }

    // Console output
    if (isError) {
      console.error(`[${cat}] ${msg}`, data !== undefined ? data : '')
    } else if (enabled === 'all' || (enabled && enabled.has(cat))) {
      console.log(`[${cat}] ${msg}`, data !== undefined ? data : '')
    }
  }
}

export const log = {
  save: createCategoryLogger('save'),
  render: createCategoryLogger('render'),
  action: createCategoryLogger('action'),
  filter: createCategoryLogger('filter'),
  api: createCategoryLogger('api'),
  auth: createCategoryLogger('auth'),
  store: createCategoryLogger('store'),
  error: createCategoryLogger('error'),

  /** Clear all stored logs */
  clear: () => { localStorage.removeItem(STORAGE_KEY) },

  /** Get all stored logs as array */
  entries: (): LogEntry[] => readEntries(),

  /** Get logs filtered by category */
  get: (cat?: LogCategory): LogEntry[] => {
    const all = readEntries()
    return cat ? all.filter(e => e.cat === cat) : all
  },

  /** Pretty-print logs to console */
  dump: (cat?: LogCategory) => {
    const entries = cat ? readEntries().filter(e => e.cat === cat) : readEntries()
    console.table(entries.map(e => ({
      time: e.ts.slice(11, 23),
      cat: e.cat,
      msg: e.msg,
      data: e.data ? JSON.stringify(e.data).slice(0, 120) : '',
    })))
  },

  /** Export logs as JSON string (for copy-paste) */
  export: (): string => {
    return JSON.stringify(readEntries(), null, 2)
  },
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__datorio_logs = log.dump;
  (window as unknown as Record<string, unknown>).__datorio_export = log.export
}
