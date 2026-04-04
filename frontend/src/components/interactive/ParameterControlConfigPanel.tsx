import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { controlsApi, ParameterControlConfig } from '@/api/controls'
import { datasourceApi } from '@/api/datasources'
import { reportApi } from '@/api/reports'
import type { ReportParameter } from '@/types'
import type { DataSource } from '@/types'
import { Settings, Trash2, MoreVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import SqlCodeEditor from '@/components/common/SqlCodeEditor'
import { queryApi } from '@/api/queries'

interface Props {
  reportId: number
  parameters: ReportParameter[]
  onParameterDefaultChange?: (paramName: string, value: string) => void
}

const CONTROL_TYPES = [
  { value: 'INPUT', labelKey: 'interactive.control.text_input' },
  { value: 'DROPDOWN', labelKey: 'interactive.control.dropdown' },
  { value: 'SLIDER', labelKey: 'interactive.control.slider' },
  { value: 'RADIO', labelKey: 'interactive.control.radio' },
  { value: 'DATE_PICKER', labelKey: 'interactive.control.date_picker' },
  { value: 'MULTI_CHECKBOX', labelKey: 'interactive.control.multi_checkbox' },
]

export default function ParameterControlConfigPanel({ reportId, parameters, onParameterDefaultChange }: Props) {
  const { t } = useTranslation()
  const [controls, setControls] = useState<ParameterControlConfig[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  // Default value picker state: { paramName, options, hasMore, columnName, loading, open, query }
  const [picker, setPicker] = useState<{
    paramName: string
    options: string[]
    hasMore: boolean
    columnName: string
    loading: boolean
    open: boolean
    query: string
  } | null>(null)
  const pickerDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const [sqlEditor, setSqlEditor] = useState<{ paramName: string; sql: string; datasourceId: number } | null>(null)

  const load = () => {
    controlsApi.getParameterControls(reportId).then(setControls).catch(() => {})
  }

  useEffect(load, [reportId])
  useEffect(() => {
    datasourceApi.list().then(setDatasources).catch(() => {})
  }, [])

  const save = async (paramName: string, update: Partial<ParameterControlConfig>) => {
    const existing = controls.find(c => c.parameterName === paramName)
    try {
      await controlsApi.saveParameterControl({
        reportId,
        parameterName: paramName,
        controlType: update.controlType ?? existing?.controlType ?? 'INPUT',
        datasourceId: update.datasourceId ?? existing?.datasourceId ?? undefined,
        optionsQuery: update.optionsQuery ?? existing?.optionsQuery ?? undefined,
        sliderMin: update.sliderMin ?? existing?.sliderMin ?? undefined,
        sliderMax: update.sliderMax ?? existing?.sliderMax ?? undefined,
        sliderStep: update.sliderStep ?? existing?.sliderStep ?? undefined,
        sortOrder: update.sortOrder ?? existing?.sortOrder ?? 0,
      })
      load()
      toast.success(t('interactive.control.saved'))
    } catch {
      toast.error(t('interactive.control.failed_save'))
    }
  }

  const remove = async (paramName: string) => {
    try {
      await controlsApi.deleteParameterControl(reportId, paramName)
      load()
    } catch {
      toast.error(t('interactive.control.failed_remove'))
    }
  }

  const openPicker = async (paramName: string) => {
    setPicker({ paramName, options: [], hasMore: false, columnName: '', loading: true, open: true, query: '' })
    try {
      // Pass default values of ALL other parameters so any :param in SQL gets substituted
      const parentValues: Record<string, string> = {}
      for (const p of parameters) {
        if (p.name === paramName) continue
        if (p.defaultValue) parentValues[p.name] = p.defaultValue
      }
      const res = await controlsApi.loadOptions(reportId, paramName, Object.keys(parentValues).length > 0 ? parentValues : undefined)
      setPicker(prev => prev ? {
        ...prev,
        options: res.options,
        hasMore: res.hasMore ?? false,
        columnName: res.columnName ?? '',
        loading: false,
      } : null)
    } catch {
      setPicker(null)
      toast.error(t('common.operation_failed'))
    }
  }

  const pickerSearch = useCallback((q: string) => {
    if (!picker) return
    setPicker(prev => prev ? { ...prev, query: q } : null)
    if (!picker.hasMore) return  // filter client-side for small lists
    clearTimeout(pickerDebounceRef.current)
    pickerDebounceRef.current = setTimeout(async () => {
      if (!picker.columnName) return
      setPicker(prev => prev ? { ...prev, loading: true } : null)
      try {
        const res = await controlsApi.searchOptions(reportId, picker.paramName, q, picker.columnName)
        setPicker(prev => prev ? { ...prev, options: res.options, loading: false } : null)
      } catch {
        setPicker(prev => prev ? { ...prev, loading: false } : null)
      }
    }, 300)
  }, [picker, reportId])

  const selectDefault = async (paramName: string, value: string) => {
    try {
      const payload = parameters.map((p, i) => ({
        id: p.id,
        name: p.name,
        label: p.label || '',
        paramType: p.paramType,
        defaultValue: p.name === paramName ? value : (p.defaultValue || ''),
        isRequired: p.isRequired,
        sortOrder: i,
        config: typeof p.config === 'string' ? p.config : JSON.stringify(p.config || {}),
      }))
      await reportApi.setParameters(reportId, payload as unknown as Array<Record<string, unknown>>)
      onParameterDefaultChange?.(paramName, value)
      toast.success(t('interactive.control.saved'))
    } catch {
      toast.error(t('interactive.control.failed_save'))
    }
    setPicker(null)
  }

  const pickerVisible = picker?.hasMore
    ? picker.options
    : (picker?.options ?? []).filter(o => !picker?.query || o.toLowerCase().includes(picker.query.toLowerCase()))

  return (
    <>
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
        <Settings className="w-4 h-4 text-brand-500" /> {t('interactive.parameter_controls')}
      </h3>

      <div className="space-y-3">
        {parameters.map(p => {
          const ctrl = controls.find(c => c.parameterName === p.name)
          return (
            <div key={p.name} className="card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {p.label || p.name}
                  <span className="text-xs text-slate-400 ml-2">({p.paramType})</span>
                </p>
                {ctrl && (
                  <button onClick={() => remove(p.name)}
                    className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control_type')}</label>
                  <select
                    value={ctrl?.controlType || 'INPUT'}
                    onChange={e => save(p.name, { controlType: e.target.value })}
                    className="input text-xs py-1 w-36"
                  >
                    {CONTROL_TYPES.map(ct => (
                      <option key={ct.value} value={ct.value}>{t(ct.labelKey)}</option>
                    ))}
                  </select>
                </div>

                {(ctrl?.controlType === 'SLIDER') && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.min')}</label>
                      <input type="number" value={ctrl?.sliderMin ?? 0}
                        onChange={e => save(p.name, { sliderMin: Number(e.target.value) })}
                        className="input text-xs py-1 w-20" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.max')}</label>
                      <input type="number" value={ctrl?.sliderMax ?? 100}
                        onChange={e => save(p.name, { sliderMax: Number(e.target.value) })}
                        className="input text-xs py-1 w-20" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.step')}</label>
                      <input type="number" value={ctrl?.sliderStep ?? 1}
                        onChange={e => save(p.name, { sliderStep: Number(e.target.value) })}
                        className="input text-xs py-1 w-20" />
                    </div>
                  </>
                )}

                {(ctrl?.controlType === 'DROPDOWN' || ctrl?.controlType === 'RADIO' || ctrl?.controlType === 'MULTI_CHECKBOX') && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('designer.data_source')}</label>
                      <select
                        value={ctrl?.datasourceId || ''}
                        onChange={e => save(p.name, { datasourceId: e.target.value ? Number(e.target.value) : undefined })}
                        className="input text-xs py-1 w-56"
                      >
                        <option value="">{t('designer.select_datasource')}</option>
                        {datasources.map(ds => (
                          <option key={ds.id} value={ds.id}>{ds.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.options_sql')}</label>
                      <div className="flex gap-1">
                        <input value={ctrl?.optionsQuery || ''}
                          onChange={e => save(p.name, { optionsQuery: e.target.value })}
                          placeholder={t('interactive.control.sql_placeholder')}
                          className="input text-xs py-1 flex-1" />
                        {ctrl?.datasourceId && (
                          <button
                            onClick={() => setSqlEditor({ paramName: p.name, sql: ctrl?.optionsQuery || '', datasourceId: ctrl.datasourceId! })}
                            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-dark-surface-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
                            title={t('designer.open_sql_editor')}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {ctrl?.optionsQuery && ctrl?.datasourceId && (
                      <div className="flex items-end">
                        <button
                          onClick={() => openPicker(p.name)}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          {t('interactive.control.pick_default')}
                          {p.defaultValue ? `: ${p.defaultValue}` : ''}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Default value picker modal */}
      {picker && picker.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPicker(null)}>
          <div className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-xl p-4 w-80 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              {t('interactive.control.pick_default')}
            </p>
            <input
              autoFocus
              value={picker.query}
              onChange={e => pickerSearch(e.target.value)}
              placeholder="..."
              className="input text-sm mb-2"
            />
            <div className="flex-1 overflow-y-auto space-y-0.5">
              {picker.loading ? (
                <div className="flex items-center gap-2 p-3 text-xs text-slate-400">
                  <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                  {t('common.loading')}
                </div>
              ) : pickerVisible.length === 0 ? (
                <p className="text-xs text-slate-400 p-2">{t('common.no_results')}</p>
              ) : (
                pickerVisible.map(opt => (
                  <button key={opt} onClick={() => selectDefault(picker.paramName, opt)}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-surface-50 dark:hover:bg-dark-surface-100 truncate">
                    {opt}
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setPicker(null)}
              className="mt-2 text-xs text-slate-400 hover:text-slate-600 self-end">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>

    {sqlEditor && createPortal(
      <OptionsSqlEditorModal
        sql={sqlEditor.sql}
        datasourceId={sqlEditor.datasourceId}
        onSave={(newSql) => { save(sqlEditor.paramName, { optionsQuery: newSql }); setSqlEditor(null) }}
        onClose={() => setSqlEditor(null)}
      />,
      document.body
    )}
    </>
  )
}

function OptionsSqlEditorModal({ sql, datasourceId, onSave, onClose }: {
  sql: string; datasourceId: number; onSave: (sql: string) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [editSql, setEditSql] = useState(sql)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number; executionMs: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExecute = useCallback(async () => {
    if (!editSql.trim()) return
    setExecuting(true)
    setError(null)
    try {
      const res = await queryApi.executeAdHoc({ datasourceId, sql: editSql, limit: 100 })
      const cols = (res.columns || []).map((c: string | { name: string }) => typeof c === 'string' ? c : c.name)
      setResult({ columns: cols, rows: res.rows || [], rowCount: res.rowCount || res.rows?.length || 0, executionMs: res.executionTimeMs || 0 })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('widget_menu.execute_failed'))
    } finally {
      setExecuting(false)
    }
  }, [datasourceId, editSql, t])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl flex flex-col m-4"
        style={{ width: 'calc(100vw - 80px)', height: 'calc(100vh - 80px)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">{t('interactive.control.options_sql')}</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleExecute} disabled={executing} className="btn-secondary text-xs px-2.5 py-1.5">
              {executing ? t('widget_menu.executing') : t('widget_menu.execute')}
            </button>
            <button onClick={() => onSave(editSql)} className="btn-primary text-xs px-3 py-1.5">{t('common.save')}</button>
            <button onClick={onClose} className="btn-secondary text-xs px-3 py-1.5">{t('common.cancel')}</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 border-b border-surface-200 dark:border-dark-surface-100" style={{ minHeight: '200px' }}>
          <SqlCodeEditor value={editSql} onChange={setEditSql} onExecute={handleExecute} />
        </div>
        {error && (
          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">{error}</div>
        )}
        {result && (
          <div className="overflow-auto flex-1">
            <div className="px-4 py-1 text-xs text-slate-400 border-b border-surface-200 dark:border-dark-surface-100">
              {result.rowCount} {t('widget_menu.rows')} / {result.executionMs}ms
            </div>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-50 dark:bg-dark-surface-100">
                <tr>
                  {result.columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-surface-200 dark:border-dark-surface-100 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-surface-100 dark:border-dark-surface-100 hover:bg-surface-50 dark:hover:bg-dark-surface-100/50">
                    {result.columns.map(col => (
                      <td key={col} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row[col] != null ? String(row[col]) : ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
