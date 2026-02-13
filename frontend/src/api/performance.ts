import api from './client'

export interface CacheStats {
  hitCount: number
  missCount: number
  hitRate: number
  evictionCount: number
  entryCount: number
  estimatedSizeBytes: number
  enabled: boolean
}

export interface PoolStats {
  datasourceId: number
  datasourceName: string
  activeConnections: number
  idleConnections: number
  totalConnections: number
  maxPoolSize: number
  waitingThreads: number
}

export interface SystemHealth {
  cache: CacheStats
  connectionPools: PoolStats[]
  jvmHeapUsedMb: number
  jvmHeapMaxMb: number
  uptime: string
}

export interface ExplainResult {
  plan: string[]
  estimatedCost: number | null
  estimatedRows: number | null
  warnings: string[]
  suggestions: string[]
}

export const performanceApi = {
  getCacheStats: () =>
    api.get<CacheStats>('/performance/cache/stats').then(r => r.data),

  invalidateCache: () =>
    api.post('/performance/cache/invalidate').then(r => r.data),

  invalidateDatasourceCache: (id: number) =>
    api.post(`/performance/cache/invalidate/datasource/${id}`).then(r => r.data),

  toggleCache: (enabled: boolean) =>
    api.post('/performance/cache/toggle', null, { params: { enabled } }).then(r => r.data),

  getPoolStats: () =>
    api.get<PoolStats[]>('/performance/pools').then(r => r.data),

  getSystemHealth: () =>
    api.get<SystemHealth>('/performance/health').then(r => r.data),

  explain: (datasourceId: number, sql: string) =>
    api.post<ExplainResult>('/performance/explain', { datasourceId, sql }).then(r => r.data),

  quickAnalyze: (sql: string) =>
    api.post<string[]>('/performance/analyze', { sql }).then(r => r.data),
}
