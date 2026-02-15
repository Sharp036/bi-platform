import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { queryApi } from '@/api/queries'
import { datasourceApi } from '@/api/datasources'
import type { SavedQuery, QueryResult, DataSource } from '@/types'
import TableWidget from '@/components/charts/TableWidget'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Code2, Play, Save, Star, Trash2, Edit3, X, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 50

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
  const [resultPage, setResultPage] = useState(0)

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit dialog state
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [loadedQuery, setLoadedQuery] = useState<SavedQuery | null>(null)
  const normalizedSql = typeof sql === 'string' ? sql : ''

  const loadQueries = () =>
    queryApi.list({ size: 50 }).then(d => setQueries(d.content || [])).catch(() => {})

  useEffect(() => {
    Promise.all([
      loadQueries(),
      datasourceApi.list().then(d => { setDatasources(d || []); if (d.length > 0 && !dsId) setDsId(d[0].id) }),
    ]).catch(() => toast.error(t('common.failed_to_load'))).finally(() => setLoading(false))
  }, [])

  const handleExecute = async () => {
    if (!dsId || !normalizedSql.trim()) return
    setExecuting(true)
    try {
      const res = await queryApi.executeAdHoc({ datasourceId: dsId, sql: normalizedSql, limit: 1000 })
      setResult(res)
      setResultPage(0)
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
      setResultPage(0)
      toast.success(t('queries.executed_in', { ms: res.executionTimeMs }))
    } catch { toast.error(t('queries.execution_failed')) }
    finally { setExecuting(false) }
  }

  const handleSave = async () => {
    if (!dsId || !normalizedSql.trim() || !saveName.trim()) return
    setSaving(true)
    try {
      await queryApi.create({ name: saveName.trim(), datasourceId: dsId, sqlText: normalizedSql, description: saveDesc.trim() || undefined })
      toast.success(t('queries.saved_success'))
      setShowSaveDialog(false)
      setSaveName('')
      setSaveDesc('')
      loadQueries()
    } catch {
      toast.error(t('queries.save_failed'))
    } finally { setSaving(false) }
  }

  const handleUpdateLoaded = async () => {
    if (!loadedQuery || !normalizedSql.trim()) return
    setSaving(true)
    try {
      await queryApi.update(loadedQuery.id, { sqlText: normalizedSql })
      const fresh = await queryApi.get(loadedQuery.id)
      setLoadedQuery(fresh)
      toast.success(t('queries.updated'))
      loadQueries()
    } catch {
      toast.error(t('queries.update_failed'))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(t('queries.delete_confirm', { name }))) return
    try {
      await queryApi.delete(id)
      toast.success(t('queries.deleted'))
      setQueries(prev => prev.filter(q => q.id !== id))
    } catch {
      toast.error(t('queries.delete_failed'))
    }
  }

  const handleToggleFavorite = async (id: number) => {
    try {
      const { isFavorite } = await queryApi.toggleFavorite(id)
      setQueries(prev => prev.map(q => q.id === id ? { ...q, isFavorite } : q))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleEditSave = async () => {
    if (!editingQuery || !editName.trim()) return
    setSaving(true)
    try {
      await queryApi.update(editingQuery.id, { name: editName.trim(), description: editDesc.trim() || undefined })
      toast.success(t('queries.updated'))
      setEditingQuery(null)
      loadQueries()
    } catch {
      toast.error(t('queries.update_failed'))
    } finally { setSaving(false) }
  }

  const openEdit = (q: SavedQuery) => {
    setEditingQuery(q)
    setEditName(q.name)
    setEditDesc(q.description || '')
  }

  const handleLoadSaved = async (q: SavedQuery) => {
    try {
      const full = await queryApi.get(q.id)
      setSql(full.sqlText || '')
      setLoadedQuery(full)
      if (typeof full.datasourceId === 'number') {
        const ds = datasources.find(d => d.id === full.datasourceId)
        if (ds) setDsId(ds.id)
      }
      toast.success(t('queries.loaded_to_editor'))
    } catch {
      toast.error(t('common.failed_to_load'))
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t('queries.title')}</h1>

      {/* Ad-hoc query editor */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('queries.adhoc_title')}</h2>
        <div className="flex items-start gap-3">
          <select
            value={dsId || ''}
            onChange={e => {
              setDsId(Number(e.target.value))
              setLoadedQuery(null)
            }}
            className="input w-48 flex-shrink-0"
          >
            {datasources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
          </select>
          <textarea
            value={sql} onChange={e => setSql(e.target.value)}
            rows={3} className="input font-mono text-sm flex-1" placeholder="SELECT ..."
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleExecute() }}
          />
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={handleExecute} disabled={executing || !dsId} className="btn-primary">
              <Play className="w-4 h-4" /> {executing ? t('queries.running') : t('queries.run')}
            </button>
            <button
              onClick={() => {
                if (loadedQuery) handleUpdateLoaded()
                else {
                  setSaveName('')
                  setSaveDesc('')
                  setShowSaveDialog(true)
                }
              }}
              disabled={!dsId || !normalizedSql.trim()}
              className="btn-secondary"
            >
              <Save className="w-4 h-4" /> {loadedQuery ? t('common.update') : t('queries.save')}
            </button>
          </div>
        </div>
        {loadedQuery && (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-xs text-brand-600 dark:text-brand-400">
              {t('common.edit')}: {loadedQuery.name}
            </p>
            <button
              onClick={() => setLoadedQuery(null)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { setSaveName(''); setSaveDesc(''); setShowSaveDialog(true) }}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              {t('queries.save')}...
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1">{t('queries.ctrl_enter_hint')}</p>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{t('queries.save_query')}</h3>
              <button onClick={() => setShowSaveDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder={t('queries.name_placeholder')}
                className="input w-full" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              />
              <textarea
                value={saveDesc} onChange={e => setSaveDesc(e.target.value)}
                placeholder={t('queries.desc_placeholder')}
                className="input w-full" rows={2}
              />
              <pre className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-xs font-mono text-slate-600 dark:text-slate-300 max-h-32 overflow-auto">
                {normalizedSql}
              </pre>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowSaveDialog(false)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving || !saveName.trim()} className="btn-primary">
                <Save className="w-4 h-4" /> {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editingQuery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingQuery(null)}>
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{t('queries.edit_query')}</h3>
              <button onClick={() => setEditingQuery(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text" value={editName} onChange={e => setEditName(e.target.value)}
                placeholder={t('queries.name_placeholder')}
                className="input w-full" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleEditSave() }}
              />
              <textarea
                value={editDesc} onChange={e => setEditDesc(e.target.value)}
                placeholder={t('queries.desc_placeholder')}
                className="input w-full" rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingQuery(null)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleEditSave} disabled={saving || !editName.trim()} className="btn-primary">
                <Save className="w-4 h-4" /> {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Query result */}
      {result && (() => {
        const allRows = result.rows
        const totalRows = allRows.length
        const totalPages = Math.ceil(totalRows / PAGE_SIZE)
        const pagedRows = allRows.slice(resultPage * PAGE_SIZE, (resultPage + 1) * PAGE_SIZE)
        return (
          <div className="card p-4 mb-6 flex flex-col" style={{ maxHeight: 'min(60vh, 500px)' }}>
            <div className="flex-1 min-h-0 overflow-hidden">
              <TableWidget data={{ columns: result.columns.map(c => c.name), rows: pagedRows, rowCount: result.rowCount, executionMs: result.executionTimeMs }} />
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 mt-2 flex-shrink-0">
                <span className="text-xs text-slate-400">
                  {t('queries.showing_rows', {
                    from: resultPage * PAGE_SIZE + 1,
                    to: Math.min((resultPage + 1) * PAGE_SIZE, totalRows),
                    total: totalRows
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setResultPage(p => Math.max(0, p - 1))}
                    disabled={resultPage === 0}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  </button>
                  <span className="text-xs text-slate-500 min-w-[60px] text-center">
                    {resultPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setResultPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={resultPage >= totalPages - 1}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Saved queries list */}
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">{t('queries.saved_queries')}</h2>
      {queries.length === 0 ? (
        <EmptyState icon={<Code2 className="w-12 h-12" />} title={t('queries.no_saved')} description={t('queries.save_to_see')} />
      ) : (
        <div className="space-y-2">
          {queries.map(q => (
            <div key={q.id} className="card px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button onClick={() => handleToggleFavorite(q.id)} className="flex-shrink-0">
                  <Star className={`w-4 h-4 ${q.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-300 hover:text-amber-400'}`} />
                </button>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleLoadSaved(q)}>
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{q.name}</p>
                  <p className="text-xs text-slate-400">{q.datasourceName} · {q.queryMode} · {t('queries.runs', { count: q.executionCount })}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleExecuteSaved(q.id)} disabled={executing} className="btn-secondary text-xs">
                  <Play className="w-3.5 h-3.5" /> {t('queries.run')}
                </button>
                <button onClick={() => openEdit(q)} className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" title={t('common.edit')}>
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(q.id, q.name)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title={t('common.delete')}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
