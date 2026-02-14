import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { performanceApi } from '@/api/performance'
import type { SystemHealth, ExplainResult } from '@/api/performance'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { Activity, Database, Zap, HardDrive, RefreshCw, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function MonitoringPage() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [explainSql, setExplainSql] = useState('')
  const [explainDs, setExplainDs] = useState('')
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null)

  const load = () => {
    setLoading(true)
    performanceApi.getSystemHealth()
      .then(setHealth)
      .catch(() => toast.error(t('common.failed_to_load')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleClearCache = async () => {
    try {
      await performanceApi.invalidateCache()
      toast.success(t('monitoring.cache_cleared'))
      load()
    } catch { toast.error(t('common.operation_failed')) }
  }

  const handleToggleCache = async () => {
    if (!health) return
    try {
      await performanceApi.toggleCache(!health.cache.enabled)
      toast.success(health.cache.enabled ? t('monitoring.cache_disabled') : t('monitoring.cache_enabled'))
      load()
    } catch { toast.error(t('common.operation_failed')) }
  }

  const handleExplain = async () => {
    if (!explainSql.trim() || !explainDs) { toast.error(t('common.operation_failed')); return }
    try {
      const result = await performanceApi.explain(Number(explainDs), explainSql)
      setExplainResult(result)
    } catch { toast.error(t('common.operation_failed')) }
  }

  if (loading && !health) return <LoadingSpinner />

  const cache = health?.cache
  const heapPct = health ? Math.round((health.jvmHeapUsedMb / health.jvmHeapMaxMb) * 100) : 0

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('monitoring.title')}</h1>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Activity} label={t('monitoring.uptime')} value={health?.uptime || '—'} color="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30" />
        <StatCard icon={HardDrive} label={t('monitoring.jvm_heap')} value={`${health?.jvmHeapUsedMb || 0} / ${health?.jvmHeapMaxMb || 0} MB`}
          color={heapPct > 80 ? "text-red-600 bg-red-50 dark:bg-red-900/30" : "text-brand-600 bg-brand-50 dark:bg-brand-900/30"} />
        <StatCard icon={Zap} label={t('monitoring.cache_hit_rate')} value={cache ? `${(cache.hitRate * 100).toFixed(1)}%` : '—'}
          color="text-amber-600 bg-amber-50 dark:bg-amber-900/30" />
        <StatCard icon={Database} label={t('monitoring.cache_entries')} value={String(cache?.entryCount || 0)}
          color="text-purple-600 bg-purple-50 dark:bg-purple-900/30" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Query Cache */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">{t('monitoring.query_cache')}</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleToggleCache} className="btn-ghost p-1.5" title={cache?.enabled ? t('monitoring.cache_disabled') : t('monitoring.cache_enabled')}>
                {cache?.enabled
                  ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                  : <ToggleLeft className="w-5 h-5 text-slate-400" />}
              </button>
              <button onClick={handleClearCache} className="btn-ghost p-1.5 text-red-500" title={t('monitoring.clear_cache')}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {cache && (
            <div className="space-y-3">
              <MetricRow label={t('monitoring.metric.status')} value={cache.enabled ? t('common.status.enabled') : t('common.status.disabled')}
                valueClass={cache.enabled ? 'text-emerald-500' : 'text-red-500'} />
              <MetricRow label={t('monitoring.metric.hit_rate')} value={`${(cache.hitRate * 100).toFixed(1)}%`} />
              <MetricRow label={t('monitoring.metric.hits_misses')} value={`${cache.hitCount} / ${cache.missCount}`} />
              <MetricRow label={t('monitoring.metric.evictions')} value={String(cache.evictionCount)} />
              <MetricRow label={t('monitoring.metric.entries')} value={String(cache.entryCount)} />
              <MetricRow label={t('monitoring.metric.est_size')} value={`${(cache.estimatedSizeBytes / 1024).toFixed(0)} KB`} />
            </div>
          )}
        </div>

        {/* Connection Pools */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">{t('monitoring.connection_pools')}</h2>

          {!health?.connectionPools?.length ? (
            <p className="text-sm text-slate-400">{t('monitoring.no_pools')}</p>
          ) : (
            <div className="space-y-4">
              {health.connectionPools.map(pool => {
                const usage = pool.maxPoolSize > 0 ? (pool.activeConnections / pool.maxPoolSize) * 100 : 0
                return (
                  <div key={pool.datasourceId} className="border border-surface-200 dark:border-dark-surface-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{pool.datasourceName}</span>
                      <span className="text-xs text-slate-400">#{pool.datasourceId}</span>
                    </div>
                    {/* Usage bar */}
                    <div className="h-2 bg-surface-100 dark:bg-dark-surface-100 rounded-full mb-2 overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all',
                          usage > 80 ? 'bg-red-500' : usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        )}
                        style={{ width: `${Math.min(usage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{t('monitoring.pool.active')} {pool.activeConnections} / {pool.maxPoolSize}</span>
                      <span>{t('monitoring.pool.idle')} {pool.idleConnections}</span>
                      {pool.waitingThreads > 0 && (
                        <span className="text-red-500">{t('monitoring.pool.waiting')} {pool.waitingThreads}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Query Optimizer */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">{t('monitoring.query_advisor')}</h2>

        <div className="flex gap-3 mb-3">
          <input
            type="number" value={explainDs} onChange={e => setExplainDs(e.target.value)}
            placeholder="Datasource ID" className="input text-sm w-36"
          />
          <div className="flex-1">
            <textarea
              value={explainSql} onChange={e => setExplainSql(e.target.value)}
              placeholder="SELECT * FROM orders WHERE ..."
              className="input text-sm font-mono h-16 resize-none w-full"
            />
          </div>
          <button onClick={handleExplain} className="btn-primary text-sm self-start">
            <Search className="w-4 h-4" /> {t('monitoring.explain')}
          </button>
        </div>

        {explainResult && (
          <div className="mt-4 space-y-3">
            {/* Plan */}
            <div className="bg-surface-50 dark:bg-dark-surface-100 rounded-lg p-3 font-mono text-xs overflow-x-auto">
              {explainResult.plan.map((line, i) => (
                <div key={i} className="text-slate-600 dark:text-slate-400 whitespace-pre">{line}</div>
              ))}
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              {explainResult.estimatedCost != null && (
                <span className="text-slate-500">Cost: <span className="font-semibold">{explainResult.estimatedCost.toFixed(1)}</span></span>
              )}
              {explainResult.estimatedRows != null && (
                <span className="text-slate-500">Est. rows: <span className="font-semibold">{explainResult.estimatedRows.toLocaleString()}</span></span>
              )}
            </div>

            {/* Warnings */}
            {explainResult.warnings.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-red-500 mb-1">{t('monitoring.warnings')}</h4>
                {explainResult.warnings.map((w, i) => (
                  <p key={i} className="text-sm text-red-600 dark:text-red-400">⚠ {w}</p>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {explainResult.suggestions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-emerald-500 mb-1">{t('monitoring.suggestions')}</h4>
                {explainResult.suggestions.map((s, i) => (
                  <p key={i} className="text-sm text-emerald-600 dark:text-emerald-400">💡 {s}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-800 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  )
}

function MetricRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={clsx('font-medium text-slate-700 dark:text-slate-300', valueClass)}>{value}</span>
    </div>
  )
}
