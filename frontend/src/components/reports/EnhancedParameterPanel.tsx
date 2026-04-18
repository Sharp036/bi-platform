import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReportParameter } from '@/types'
import { controlsApi, ParameterControlConfig } from '@/api/controls'
import { Play } from 'lucide-react'
import clsx from 'clsx'
import { log } from '@/utils/logger'

interface Props {
  reportId: number
  parameters: ReportParameter[]
  onApply: (values: Record<string, unknown>) => void
  loading?: boolean
  compact?: boolean
  className?: string
  currentParameters?: Record<string, unknown>
  /** Changing this value triggers a reload of all dropdown options.
   *  Bump from the parent (e.g. on Refresh button) to refetch filter options
   *  after the underlying data source changed. */
  refreshKey?: number
}

export default function EnhancedParameterPanel({
  reportId,
  parameters,
  onApply,
  loading,
  compact = false,
  className = '',
  currentParameters,
  refreshKey = 0,
}: Props) {
  const { t } = useTranslation()
  const resolveDynamicDefault = (p: ReportParameter): string => {
    const raw = (p.defaultValue || '').trim()
    if (!raw) return ''
    const token = raw.toLowerCase()
    const now = new Date()
    const toDate = (d: Date) => d.toISOString().slice(0, 10)
    if (token === 'today' || token === '__today__' || token === '${today}') return toDate(now)
    if (token === 'start_of_year' || token === '__start_of_year__' || token === '${start_of_year}') {
      return toDate(new Date(now.getFullYear(), 0, 1))
    }
    if (token === 'start_of_month' || token === '__start_of_month__' || token === '${start_of_month}') {
      return toDate(new Date(now.getFullYear(), now.getMonth(), 1))
    }
    if (token === 'end_of_year' || token === '__end_of_year__' || token === '${end_of_year}') {
      return toDate(new Date(now.getFullYear(), 11, 31))
    }
    return raw
  }

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    parameters.forEach(p => {
      const current = currentParameters?.[p.name]
      if (current !== undefined) {
        init[p.name] = String(current)
      } else if (p.defaultValue) {
        init[p.name] = resolveDynamicDefault(p)
      }
    })
    return init
  })
  const [controls, setControls] = useState<ParameterControlConfig[]>([])
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({})
  const [hasMoreByParam, setHasMoreByParam] = useState<Record<string, boolean>>({})
  const [columnByParam, setColumnByParam] = useState<Record<string, string>>({})

  // Remember last non-empty user-selected value per parameter for smart cascade restore
  const lastKnownRef = useRef<Record<string, string>>({})

  // Load control configs. Refetch when refreshKey bumps so users pick up
  // newly added controls without page reload.
  useEffect(() => {
    controlsApi.getParameterControls(reportId)
      .then(setControls)
      .catch(() => {})
  }, [reportId, refreshKey])

  // Load dynamic options for a single parameter. Returns the loaded options
  // so callers can decide whether to auto-select (e.g. for required params).
  const loadOptions = useCallback(async (paramName: string, parentValues: Record<string, string> = {}): Promise<string[]> => {
    try {
      const result = await controlsApi.loadOptions(reportId, paramName, parentValues)
      setDynamicOptions(prev => ({ ...prev, [paramName]: result.options }))
      setHasMoreByParam(prev => ({ ...prev, [paramName]: result.hasMore ?? false }))
      if (result.columnName) {
        setColumnByParam(prev => ({ ...prev, [paramName]: result.columnName! }))
      }
      return result.options
    } catch {
      return []
    }
  }, [reportId])

  // Collect all other non-empty parameter values (so any :param in options SQL gets substituted)
  const collectParentValues = useCallback((paramName: string, vals: Record<string, string>) => {
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(vals)) {
      if (k !== paramName && v && v.trim()) result[k] = v
    }
    return result
  }, [])

  // Stable key derived from parameter names — avoids resetting values on every render
  const paramKey = parameters.map(p => p.name).join(',')

  // Build values from parameters + currentParameters, then load all dropdown options
  useEffect(() => {
    const init: Record<string, string> = {}
    parameters.forEach(p => {
      const current = currentParameters?.[p.name]
      if (current !== undefined) {
        init[p.name] = String(current)
      } else if (p.defaultValue) {
        init[p.name] = resolveDynamicDefault(p)
      }
    })
    setValues(init)
  }, [paramKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load dropdown options whenever controls are ready, visible parameters change,
  // or the parent bumps refreshKey (e.g. via the Refresh button after data changed).
  //
  // Two-phase loading handles required parameters with auto-select:
  //   Phase 1: Load options for ALL dropdowns in parallel with known values.
  //   Phase 2: For any required parameter that ended up empty, auto-select
  //            the first option, then reload dropdowns whose SQL references
  //            that parameter (so their options reflect the auto-fill).
  //
  // Without phase 2, ClickHouse queries like `WHERE toDate(:ml_dt)` fail on
  // empty strings, leaving dependent dropdowns with no options.
  useEffect(() => {
    if (controls.length === 0) return

    const runCascade = async () => {
      const allVals: Record<string, string> = {}
      if (currentParameters) {
        for (const [k, v] of Object.entries(currentParameters)) {
          if (v !== undefined && v !== null && v !== '') allVals[k] = String(v)
        }
      }
      parameters.forEach(p => {
        if (!(p.name in allVals) && p.defaultValue) {
          allVals[p.name] = resolveDynamicDefault(p)
        }
      })
      const visibleNames = new Set(parameters.map(p => p.name))
      const relevantControls = controls.filter(
        c => c.optionsQuery && c.datasourceId && visibleNames.has(c.parameterName),
      )

      // Phase 1: load all dropdown options in parallel
      const phase1 = await Promise.all(
        relevantControls.map(async c => {
          const options = await loadOptions(
            c.parameterName,
            collectParentValues(c.parameterName, allVals),
          )
          return { control: c, options }
        }),
      )

      // Phase 2: auto-select first option for required params and collect affected names
      const autoFilled: Record<string, string> = {}
      phase1.forEach(({ control: c, options }) => {
        if (options.length === 0) return
        const p = parameters.find(p => p.name === c.parameterName)
        if (!p?.isRequired) return
        const currentVal = allVals[c.parameterName] || ''
        if (!currentVal || !options.includes(currentVal)) {
          autoFilled[c.parameterName] = options[0]
        }
      })

      if (Object.keys(autoFilled).length === 0) return

      setValues(prev => ({ ...prev, ...autoFilled }))
      const updatedVals = { ...allVals, ...autoFilled }

      // Reload dropdowns that reference any auto-filled parameter
      const affected = new Set<string>()
      for (const filledName of Object.keys(autoFilled)) {
        const pattern = new RegExp(`:${filledName}(?![a-zA-Z0-9_])`)
        relevantControls.forEach(c => {
          if (c.parameterName === filledName) return
          if (pattern.test(c.optionsQuery!)) affected.add(c.parameterName)
        })
      }
      await Promise.all(
        [...affected].map(name =>
          loadOptions(name, collectParentValues(name, updatedVals)),
        ),
      )
    }

    runCascade()
  }, [controls, paramKey, refreshKey, loadOptions, collectParentValues]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle cascading: when any parameter changes, reload dropdowns whose SQL references it.
  // Keep the current value of dependent params; only clear it if the new options no longer include it.
  const handleChange = (paramName: string, value: string) => {
    log.filter('handleChange', { paramName, value })
    // Track last non-empty selection
    if (value) lastKnownRef.current[paramName] = value

    setValues(prev => {
      const next = { ...prev, [paramName]: value }
      const pattern = new RegExp(`:${paramName}(?![a-zA-Z0-9_])`)

      controls.forEach(c => {
        if (!c.optionsQuery || !c.datasourceId) return
        if (c.parameterName === paramName) return
        if (!pattern.test(c.optionsQuery)) return
        const prevValue = next[c.parameterName] || ''
        const param = parameters.find(p => p.name === c.parameterName)
        const parentVals = collectParentValues(c.parameterName, next)
        controlsApi.loadOptions(reportId, c.parameterName, parentVals)
          .then(result => {
            setDynamicOptions(prev => ({ ...prev, [c.parameterName]: result.options }))
            setHasMoreByParam(prev => ({ ...prev, [c.parameterName]: result.hasMore ?? false }))
            if (result.columnName) {
              setColumnByParam(prev => ({ ...prev, [c.parameterName]: result.columnName! }))
            }
            // Decide new value for dependent parameter
            if (prevValue && result.options.includes(prevValue)) {
              log.filter('cascade keep', { param: c.parameterName, prevValue })
            } else if (result.options.length > 0) {
              // Priority: last user selection > default value > first option (required) > empty
              const lastKnown = lastKnownRef.current[c.parameterName] || ''
              const defaultVal = param?.defaultValue ? resolveDynamicDefault(param) : ''
              const fallback = result.options.includes(lastKnown) ? lastKnown
                : result.options.includes(defaultVal) ? defaultVal
                : param?.isRequired ? (result.options[0] || '') : ''
              log.filter('cascade fallback', { param: c.parameterName, prevValue, lastKnown, defaultVal, fallback, optionsCount: result.options.length })
              setValues(v => ({ ...v, [c.parameterName]: fallback }))
            } else {
              // No options available -- clear
              setValues(v => ({ ...v, [c.parameterName]: '' }))
            }
          })
          .catch(() => {})
      })

      return next
    })
  }

  if (parameters.length === 0) return null

  const handleApply = () => {
    const typed: Record<string, unknown> = {}
    parameters.forEach(p => {
      const v = values[p.name]
      if (v === undefined) return
      if (v === '') {
        // Send empty string so backend knows user chose "All" (don't fall back to default)
        typed[p.name] = ''
        return
      }
      switch (p.paramType) {
        case 'NUMBER': typed[p.name] = Number(v); break
        case 'BOOLEAN': typed[p.name] = v === 'true'; break
        default: typed[p.name] = v
      }
    })
    onApply(typed)
  }

  const getControl = (paramName: string) => controls.find(c => c.parameterName === paramName)

  return (
    <div className={`card ${compact ? 'p-3' : 'p-4'} ${className}`}>
      <div className={`flex ${compact ? 'flex-col items-stretch gap-3' : 'flex-wrap items-end gap-4'}`}>
        {parameters.map(p => {
          const ctrl = getControl(p.name)
          const controlType = ctrl?.controlType || guessControlType(p)
          const options = dynamicOptions[p.name] || (p.config?.options as string[] | undefined) || []

          return (
            <div key={p.name} className={compact ? 'w-full' : 'flex-1 min-w-[180px] max-w-[300px]'}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {p.label || p.name}
                {p.isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {controlType === 'SLIDER' && ctrl ? (
                <SliderControl
                  value={values[p.name] || ''}
                  min={ctrl.sliderMin ?? 0}
                  max={ctrl.sliderMax ?? 100}
                  step={ctrl.sliderStep ?? 1}
                  onChange={v => handleChange(p.name, v)}
                />
              ) : controlType === 'RADIO' ? (
                <RadioControl
                  value={values[p.name] || ''}
                  options={options}
                  onChange={v => handleChange(p.name, v)}
                />
              ) : controlType === 'MULTI_CHECKBOX' ? (
                <MultiCheckboxControl
                  value={values[p.name] || ''}
                  options={options}
                  onChange={v => handleChange(p.name, v)}
                />
              ) : (controlType === 'DROPDOWN' || p.paramType === 'SELECT') && hasMoreByParam[p.name] && columnByParam[p.name] ? (
                <TypeaheadControl
                  value={values[p.name] || ''}
                  paramName={p.name}
                  reportId={reportId}
                  columnName={columnByParam[p.name]}
                  initialOptions={dynamicOptions[p.name] || []}
                  parentValues={collectParentValues(p.name, values)}
                  onChange={v => handleChange(p.name, v)}
                />
              ) : controlType === 'DROPDOWN' || p.paramType === 'SELECT' ? (
                <select
                  value={values[p.name] || ''}
                  onChange={e => handleChange(p.name, e.target.value)}
                  className="input text-sm"
                >
                  {!p.isRequired && <option value="">{t('common.all')}</option>}
                  {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : p.paramType === 'DATE' || p.paramType === 'DATE_RANGE' || controlType === 'DATE_PICKER' ? (
                <input
                  type="date"
                  value={values[p.name] || ''}
                  onChange={e => handleChange(p.name, e.target.value)}
                  className="input text-sm"
                />
              ) : p.paramType === 'BOOLEAN' ? (
                <select
                  value={values[p.name] || ''}
                  onChange={e => handleChange(p.name, e.target.value)}
                  className="input text-sm"
                >
                  <option value="">—</option>
                  <option value="true">{t('common.yes')}</option>
                  <option value="false">{t('common.no')}</option>
                </select>
              ) : (
                <input
                  type={p.paramType === 'NUMBER' ? 'number' : 'text'}
                  value={values[p.name] || ''}
                  onChange={e => handleChange(p.name, e.target.value)}
                  placeholder={p.defaultValue || ''}
                  className="input text-sm"
                />
              )}
            </div>
          )
        })}

        <button
          onClick={handleApply}
          disabled={loading}
          className={`btn-primary h-[38px] ${compact ? 'w-full justify-center' : ''}`}
        >
          <Play className="w-4 h-4" />
          {t('common.apply')}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════

function TypeaheadControl({ value, paramName, reportId, columnName, initialOptions, parentValues, onChange }: {
  value: string
  paramName: string
  reportId: number
  columnName: string
  initialOptions?: string[]
  parentValues?: Record<string, string>
  onChange: (v: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [options, setOptions] = useState<string[]>(initialOptions || [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  // Update options when initialOptions change (e.g. after cascade reload)
  useEffect(() => {
    if (initialOptions) setOptions(initialOptions)
  }, [initialOptions])

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      // Show initial options when input is cleared
      setOptions(initialOptions || [])
      setOpen((initialOptions || []).length > 0)
      return
    }
    setLoading(true)
    controlsApi.searchOptions(reportId, paramName, q, columnName, 50, parentValues)
      .then(res => { setOptions(res.options); setOpen(true) })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [reportId, paramName, columnName, initialOptions, parentValues])

  const handleInput = (q: string) => {
    setQuery(q)
    onChange(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
  }

  const handleSelect = (opt: string) => {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync value from outside (e.g. reset)
  useEffect(() => { setQuery(value) }, [value])

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (query.trim()) search(query); else if (options.length > 0) setOpen(true) }}
        className="input text-sm w-full"
        placeholder="..."
        autoComplete="off"
      />
      {open && (loading || options.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-dark-surface-50 border border-surface-200 dark:border-dark-surface-100 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-slate-400">...</div>
          ) : (
            <>
              <button
                onClick={() => handleSelect('')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-surface-50 dark:hover:bg-dark-surface-100 border-b border-surface-100 dark:border-dark-surface-100"
              >
                -- все --
              </button>
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-50 dark:hover:bg-dark-surface-100 truncate"
                >
                  {opt}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SliderControl({ value, min, max, step, onChange }: {
  value: string; min: number; max: number; step: number; onChange: (v: string) => void
}) {
  const numVal = value ? Number(value) : min
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min} max={max} step={step}
        value={numVal}
        onChange={e => onChange(e.target.value)}
        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer
          bg-surface-200 dark:bg-dark-surface-100
          accent-brand-500"
      />
      <span className="text-sm font-mono text-slate-600 dark:text-slate-300 w-12 text-right">
        {numVal}
      </span>
    </div>
  )
}

function RadioControl({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label key={opt} className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors',
          value === opt
            ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-900/30 dark:text-brand-400 dark:ring-brand-700'
            : 'bg-surface-100 text-slate-600 hover:bg-surface-200 dark:bg-dark-surface-100 dark:text-slate-300'
        )}>
          <input
            type="radio" checked={value === opt}
            onChange={() => onChange(opt)} className="sr-only"
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

function MultiCheckboxControl({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void
}) {
  const selected = value ? value.split(',').map(s => s.trim()) : []

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt]
    onChange(next.join(','))
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <label key={opt} className={clsx(
          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
          selected.includes(opt)
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
            : 'bg-surface-100 text-slate-500 hover:bg-surface-200 dark:bg-dark-surface-100 dark:text-slate-400'
        )}>
          <input
            type="checkbox" checked={selected.includes(opt)}
            onChange={() => toggle(opt)} className="sr-only"
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

/** Infer control type from parameter definition */
function guessControlType(p: ReportParameter): string {
  if (p.paramType === 'SELECT') return 'DROPDOWN'
  if (p.paramType === 'MULTI_SELECT') return 'MULTI_CHECKBOX'
  if (p.paramType === 'BOOLEAN') return 'RADIO'
  if (p.paramType === 'DATE' || p.paramType === 'DATE_RANGE') return 'DATE_PICKER'
  return 'INPUT'
}
