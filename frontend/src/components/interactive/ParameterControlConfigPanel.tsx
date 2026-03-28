import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { controlsApi, ParameterControlConfig } from '@/api/controls'
import { datasourceApi } from '@/api/datasources'
import { reportApi } from '@/api/reports'
import type { ReportParameter } from '@/types'
import type { DataSource } from '@/types'
import { Settings, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

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
                      <input value={ctrl?.optionsQuery || ''}
                        onChange={e => save(p.name, { optionsQuery: e.target.value })}
                        placeholder={t('interactive.control.sql_placeholder')}
                        className="input text-xs py-1 w-64" />
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
  )
}
