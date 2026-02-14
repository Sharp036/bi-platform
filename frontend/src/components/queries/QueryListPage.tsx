import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { queryApi } from '@/api/queries'
import { datasourceApi } from '@/api/datasources'
import type { SavedQuery, QueryResult, DataSource } from '@/types'
import TableWidget from '@/components/charts/TableWidget'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Code2, Play, Star } from 'lucide-react'
import toast from 'react-hot-toast'

export default function QueryListPage() {
  const { t } = useTranslation()
  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)

  // Ad-hoc query state
  const [sql, setSql] = useState('SELECT 1 AS test')
  const [dsId, setDsId] = useState<number | null>(null)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)

  useEffect(() => {
    Promise.all([
      queryApi.list({ size: 50 }).then(d => setQueries(d.content || [])),
      datasourceApi.list().then(d => { setDatasources(d || []); if (d.length > 0 && !dsId) setDsId(d[0].id) }),
    ]).catch(() => toast.error(t('common.failed_to_load'))).finally(() => setLoading(false))
  }, [])

  const handleExecute = async () => {
    if (!dsId || !sql.trim()) return
    setExecuting(true)
    try {
      const res = await queryApi.executeAdHoc({ datasourceId: dsId, sql, limit: 1000 })
      setResult(res)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('queries.query_failed')
      toast.error(msg)
    } finally { setExecuting(false) }
  }

  const handleExecuteSaved = async (id: number) => {
    setExecuting(true)
    try {
      const res = await queryApi.execute(id)
      setResult(res)
      toast.success(t('queries.executed_in', { ms: res.executionTimeMs }))
    } catch { toast.error(t('queries.execution_failed')) }
    finally { setExecuting(false) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t('queries.title')}</h1>

      {/* Ad-hoc query editor */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('queries.adhoc_title')}</h2>
        <div className="flex items-start gap-3">
          <select value={dsId || ''} onChange={e => setDsId(Number(e.target.value))} className="input w-48 flex-shrink-0">
            {datasources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
          </select>
          <textarea
            value={sql} onChange={e => setSql(e.target.value)}
            rows={3} className="input font-mono text-sm flex-1" placeholder="SELECT ..."
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleExecute() }}
          />
          <button onClick={handleExecute} disabled={executing || !dsId} className="btn-primary flex-shrink-0 self-end">
            <Play className="w-4 h-4" /> {executing ? t('queries.running') : t('queries.run')}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">{t('queries.ctrl_enter_hint')}</p>
      </div>

      {/* Query result */}
      {result && (
        <div className="card p-4 mb-6" style={{ maxHeight: '400px' }}>
          <TableWidget data={{ columns: result.columns.map(c => c.name), rows: result.rows, rowCount: result.rowCount, executionMs: result.executionTimeMs }} />
        </div>
      )}

      {/* Saved queries list */}
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">{t('queries.saved_queries')}</h2>
      {queries.length === 0 ? (
        <EmptyState icon={<Code2 className="w-12 h-12" />} title={t('queries.no_saved')} description={t('queries.save_to_see')} />
      ) : (
        <div className="space-y-2">
          {queries.map(q => (
            <div key={q.id} className="card px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {q.isFavorite && <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{q.name}</p>
                  <p className="text-xs text-slate-400">{q.datasourceName} · {q.queryMode} · {t('queries.runs', { count: q.executionCount })}</p>
                </div>
              </div>
              <button onClick={() => handleExecuteSaved(q.id)} disabled={executing} className="btn-secondary text-xs">
                <Play className="w-3.5 h-3.5" /> {t('queries.run')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
