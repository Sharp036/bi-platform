import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { SavedQuery, DataSource } from '@/types'
import { queryApi } from '@/api/queries'
import { datasourceApi } from '@/api/datasources'
import { interactiveApi } from '@/api/interactive'
import { reportApi } from '@/api/reports'
import { buildDesignerParameterValues, mergeSqlParameterKeys } from '@/utils/designerParameters'
import { Trash2, Copy, Eye, EyeOff, RefreshCw, CheckSquare, Square, ToggleLeft, Plus, X, MoreVertical, Play } from 'lucide-react'
import { createPortal } from 'react-dom'
import SqlCodeEditor from '@/components/common/SqlCodeEditor'
import NumericInput from '@/components/common/NumericInput'
import { CHART_TYPE_OPTIONS } from '@/components/charts/chartTypeBuilders'
import OptionsPane from '@/components/designer/options/OptionsPane'
import { COMMON_OPTIONS, COMMON_CATEGORIES } from '@/components/designer/options/commonOptions'
import LayerSettingsAccordion from '@/components/designer/options/LayerSettingsAccordion'
import { initLayersFromFields } from '@/components/designer/options/layerOps'
import ChartMarkerOptions from '@/components/designer/options/ChartMarkerOptions'
import ChartPieOptions from '@/components/designer/options/ChartPieOptions'
import TableConfigOptions from '@/components/designer/options/TableConfigOptions'
import KpiConfigOptions from '@/components/designer/options/KpiConfigOptions'
import FilterConfigOptions from '@/components/designer/options/FilterConfigOptions'
import type { OptionCtx, OptionDef } from '@/components/designer/options/types'
import toast from 'react-hot-toast'

// Single source of truth for chart-type values comes from chartTypeBuilders;
// this used to be a separate hand-maintained list that diverged - users could
// not pick horizontal_bar / stacked_bar / stacked_area through the UI even
// though the chart engine handled them.
const CHART_TYPES = CHART_TYPE_OPTIONS.map(o => o.value)

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
]

// Chart types that render with axes and therefore need axis-related UI
// controls (xAxisRotation, threshold lines, etc.). Bar variants are
// represented by the bare 'bar' value with chartConfig.orientation /
// chartConfig.stacked toggling the variant - no more stacked_bar etc.
const AXIS_CHART_TYPES = [
  'bar', 'line', 'area', 'scatter', 'waterfall', 'heatmap', 'boxplot',
  'candlestick',
]

export default function PropertyPanel() {
  const { t } = useTranslation()
  const selected = useDesignerStore(s => s.selectedWidgetId)
  const widgets = useDesignerStore(s => s.widgets)
  const parameters = useDesignerStore(s => s.parameters)
  const updateWidget = useDesignerStore(s => s.updateWidget)
  const removeWidget = useDesignerStore(s => s.removeWidget)
  const duplicateWidget = useDesignerStore(s => s.duplicateWidget)
  const addServerWidget = useDesignerStore(s => s.addServerWidget)
  const reportId = useDesignerStore(s => s.reportId)
  const widgetLayersMap = useDesignerStore(s => s.widgetLayers)
  const setWidgetLayers = useDesignerStore(s => s.setWidgetLayers)

  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [availableCols, setAvailableCols] = useState<string[]>([])
  // Sample rows from the widget's preview query, used to populate distinct
  // value lists in conditional formatting UI (rowColorBy colour pickers).
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [loadingCols, setLoadingCols] = useState(false)
  const [sqlEditorOpen, setSqlEditorOpen] = useState(false)

  const widget = widgets.find(w => w.id === selected)

  useEffect(() => {
    queryApi.list({ size: 100 }).then(d => setQueries(d.content || [])).catch(() => {})
    datasourceApi.list().then(setDatasources).catch(() => {})
  }, [])

  // Auto-load columns when widget selection changes (for saved widgets with a data source)
  useEffect(() => { setAvailableCols([]); setPreviewRows([]) }, [selected])

  // Legacy migration is handled centrally in useDesignerStore.loadReport
  // (resolves widget.body from the dedicated API column, falling back to
  // chartConfig.content or HTML-in-title for old reports). No per-component
  // useEffect needed.

  useEffect(() => {
    if (!widget) return
    const hasDataSource = !!(widget.queryId || (widget.datasourceId && widget.rawSql?.trim()))
    if (hasDataSource) loadColumns()
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load chart layers when a saved CHART widget is selected, so the Layers
  // section is populated immediately - previously layers only appeared after
  // the canvas preview ran (which is what seeded the store).
  useEffect(() => {
    if (!widget || widget.widgetType !== 'CHART' || !widget.serverId) return
    if (widgetLayersMap[widget.id]) return
    interactiveApi.getLayersForWidget(widget.serverId)
      .then(layers => setWidgetLayers(widget.id, layers))
      .catch(() => {})
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-match SQL :params to report parameters and filter widget filterColumns
  const autoMatchParamMapping = useCallback((w: DesignerWidget) => {
    // Get SQL text
    let sql = ''
    if (w.datasourceId && w.rawSql?.trim()) {
      sql = w.rawSql
    } else if (w.queryId) {
      const q = queries.find(q => q.id === w.queryId)
      sql = (q as { sqlText?: string } | undefined)?.sqlText || ''
    }
    if (!sql) return

    // Extract :param_name from SQL
    const re = /(^|[^:]):([a-zA-Z_][a-zA-Z0-9_]*)/g
    const sqlParams = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = re.exec(sql)) !== null) {
      const name = (m[2] || '').trim()
      if (name) sqlParams.add(name)
    }
    if (sqlParams.size === 0) return

    // Collect report-level param names: explicit parameters + filterColumn from FILTER widgets
    const reportParamNames = new Set<string>()
    parameters.forEach(p => reportParamNames.add(p.name))
    widgets.forEach(ww => {
      if (ww.widgetType === 'FILTER') {
        const col = (ww.chartConfig as Record<string, unknown>).filterColumn as string | undefined
        if (col) reportParamNames.add(col)
      }
    })

    // Build new mapping: keep existing manual entries, add auto-matched ones
    const current = { ...w.paramMapping }
    let changed = false
    for (const sqlParam of sqlParams) {
      // Skip if already mapped (either as key or as value)
      const alreadyMappedAsKey = sqlParam in current
      const alreadyMappedAsValue = Object.values(current).includes(sqlParam)
      if (alreadyMappedAsKey || alreadyMappedAsValue) continue

      // Match: SQL param name === report param name
      if (reportParamNames.has(sqlParam)) {
        current[sqlParam] = sqlParam
        changed = true
      }
    }

    if (changed) {
      updateWidget(w.id, { paramMapping: current })
    }
  }, [parameters, widgets, queries, updateWidget])

  const loadColumns = useCallback(async () => {
    if (!widget) return
    setLoadingCols(true)
    try {
      let paramValues = buildDesignerParameterValues(parameters)
      let res
      // Prefer inline SQL when present, even if stale queryId is still set.
      // Fetch a small sample (100 rows) rather than 1 - distinct values from
      // this sample feed the rowColorBy/colorBy conditional-formatting UI.
      if (widget.datasourceId && widget.rawSql?.trim()) {
        paramValues = mergeSqlParameterKeys(widget.rawSql, paramValues)
        res = await queryApi.executeAdHoc({
          datasourceId: widget.datasourceId,
          sql: widget.rawSql,
          parameters: paramValues,
          limit: 100,
        })
      } else if (widget.queryId) {
        const selectedQuery = queries.find(q => q.id === widget.queryId)
        if (selectedQuery?.sqlText) {
          paramValues = mergeSqlParameterKeys(selectedQuery.sqlText, paramValues)
        } else {
          try {
            const fullQuery = await queryApi.get(widget.queryId)
            paramValues = mergeSqlParameterKeys(fullQuery.sqlText || '', paramValues)
          } catch {
            // Ignore fallback fetch errors; execution error will be surfaced below.
          }
        }
        res = await queryApi.execute(widget.queryId, paramValues, 100)
      }
      if (res?.columns) {
        const cols = res.columns.map((c: string | { name: string }) => typeof c === 'string' ? c : c.name)
        setAvailableCols(cols)
        setPreviewRows(Array.isArray(res.rows) ? (res.rows as Record<string, unknown>[]) : [])

        // Drop stale field references after SQL/query column changes.
        const chartCfg = (widget.chartConfig || {}) as Record<string, unknown>
        const nextCfg: Record<string, unknown> = { ...chartCfg }
        const hasAnyChange = { value: false }
        const markChanged = () => { hasAnyChange.value = true }

        const categoryField = chartCfg.categoryField as string | undefined
        if (categoryField && !cols.includes(categoryField)) {
          delete nextCfg.categoryField
          markChanged()
        }

        const allNonCat = cols.filter(c => c !== (nextCfg.categoryField as string || cols[0]))

        if (Array.isArray(chartCfg.valueFields)) {
          const valueFields = (chartCfg.valueFields as string[]).filter(f => allNonCat.includes(f))
          if (valueFields.length === 0 || valueFields.length === allNonCat.length) {
            delete nextCfg.valueFields
          } else {
            nextCfg.valueFields = valueFields
          }
          markChanged()
        }

        if (Array.isArray(chartCfg.regressionFields)) {
          const currentValueFields = Array.isArray(nextCfg.valueFields)
            ? (nextCfg.valueFields as string[])
            : allNonCat
          nextCfg.regressionFields = (chartCfg.regressionFields as string[])
            .filter(f => currentValueFields.includes(f))
          markChanged()
        }

        if (Array.isArray(chartCfg.visibleColumns)) {
          const visibleColumns = (chartCfg.visibleColumns as string[]).filter(c => cols.includes(c))
          if (visibleColumns.length === 0 || visibleColumns.length === cols.length) {
            delete nextCfg.visibleColumns
          } else {
            nextCfg.visibleColumns = visibleColumns
          }
          markChanged()
        }

        if (hasAnyChange.value) {
          updateWidget(widget.id, { chartConfig: nextCfg })
        }
      }

      // Auto-match paramMapping: extract :param from SQL, match to report params / filterColumns
      autoMatchParamMapping(widget)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('common.operation_failed'))
    }
    finally { setLoadingCols(false) }
  }, [widget?.queryId, widget?.datasourceId, widget?.rawSql, parameters, queries, t])

  if (!widget) {
    return (
      <div className="p-4 text-center text-sm text-slate-400 dark:text-slate-500">
        {t('designer.select_widget')}
      </div>
    )
  }

  const update = (updates: Partial<DesignerWidget>) => updateWidget(widget.id, updates)

  // Context for the options registry. Common options read from this; section
  // options defined below close over component locals directly.
  const optionsCtx: OptionCtx = {
    widget,
    cc: widget.chartConfig as Record<string, unknown>,
    update,
    t,
  }

  const isDataBound = !['IMAGE', 'BUTTON', 'SPACER', 'DIVIDER', 'WEBPAGE'].includes(widget.widgetType)
  const hasDataSource = !!(widget.queryId || (widget.datasourceId && widget.rawSql?.trim()))

  // Data-source section (saved query, inline SQL, columns, param mapping).
  // Render closures capture component state directly - no ctx threading needed.
  const dataSourceOptions: OptionDef[] = isDataBound ? [
    {
      id: 'ds_query', category: 'source', nameKey: 'designer.data_source',
      render: () => (
        <select
          value={widget.queryId || ''}
          onChange={e => {
            const qId = e.target.value ? Number(e.target.value) : null
            const q = queries.find(q => q.id === qId)
            update({ queryId: qId, datasourceId: q?.datasourceId || widget.datasourceId, rawSql: qId ? '' : widget.rawSql })
          }}
          className="input text-sm"
        >
          <option value="">{t('designer.select_query')}</option>
          {queries.map(q => <option key={q.id} value={q.id}>{q.name} ({q.datasourceName})</option>)}
        </select>
      ),
    },
    {
      id: 'ds_sql', category: 'source', nameKey: 'designer.inline_sql',
      render: () => (
        <>
          <select
            value={widget.datasourceId || ''}
            onChange={e => update({ datasourceId: e.target.value ? Number(e.target.value) : null, queryId: null })}
            className="input text-sm mb-2"
          >
            <option value="">{t('designer.select_datasource')}</option>
            {datasources.map(ds => <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>)}
          </select>
          <div className="relative">
            <textarea
              value={widget.rawSql}
              onChange={e => update({ rawSql: e.target.value, queryId: null })}
              placeholder={widget.datasourceId ? t('designer.sql_placeholder') : t('designer.select_datasource_first')}
              className="input text-xs font-mono h-20 resize-none pr-8"
              disabled={!widget.datasourceId}
            />
            <button
              onClick={() => setSqlEditorOpen(true)}
              disabled={!widget.datasourceId}
              className="absolute top-1 right-1 p-1 rounded hover:bg-surface-200 dark:hover:bg-dark-surface-100 text-slate-400 hover:text-slate-600 disabled:opacity-30"
              title={t('designer.open_sql_editor')}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ),
    },
    {
      id: 'ds_columns', category: 'source', nameKey: 'designer.columns',
      render: () => (
        <>
          <button onClick={loadColumns} disabled={loadingCols || !hasDataSource} className="btn-secondary text-xs w-full gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCols ? 'animate-spin' : ''}`} />
            {loadingCols ? t('designer.loading_columns') : t('designer.load_columns')}
          </button>
          {!hasDataSource && <p className="text-[10px] text-slate-400 mt-1">{t('designer.no_data_source_hint')}</p>}
        </>
      ),
    },
    {
      id: 'ds_params', category: 'source', nameKey: '',
      render: () => (
        <ParamMappingEditor
          mapping={widget.paramMapping}
          onChange={(pm) => update({ paramMapping: pm })}
          parameters={parameters}
          widgets={widgets}
        />
      ),
    },
  ] : []

  // Chart-specific section. cc/chartHasLayers close over component scope.
  const isChart = widget.widgetType === 'CHART'
  const chartCc = widget.chartConfig as Record<string, unknown>
  const chartHasLayers = (widgetLayersMap[widget.id] || []).length > 0 || chartCc.type === 'mixed'
  // Value-fields / regression locals (lifted from the chart config block so the
  // value-fields render option can use them). Only meaningful for charts.
  const chartCatField = (chartCc.categoryField as string) || ''
  const chartValFields = (chartCc.valueFields as string[]) || []
  const chartRegFields = (chartCc.regressionFields as string[]) || []
  const chartAllNonCat = availableCols.filter(c => c !== (chartCatField || availableCols[0]))
  const chartAllSelected = !Array.isArray(chartCc.valueFields)
  const chartEffFields = chartAllSelected ? chartAllNonCat : chartValFields
  const toggleValueField = (col: string) => {
    const current = chartAllSelected ? [...chartAllNonCat] : [...chartValFields]
    const next = current.includes(col) ? current.filter(c => c !== col) : [...current, col]
    if (next.length === chartAllNonCat.length) {
      const { valueFields: _drop, ...rest } = chartCc
      update({ chartConfig: rest })
    } else {
      update({ chartConfig: { ...chartCc, valueFields: next } })
    }
  }
  const toggleRegressionField = (col: string) => {
    const current = Array.isArray(chartRegFields) ? [...chartRegFields] : []
    const next = current.includes(col) ? current.filter(c => c !== col) : [...current, col]
    update({ chartConfig: { ...chartCc, regressionFields: next } })
  }
  // Effective category column (falls back to the first column, like the chart).
  const chartEffCat = chartCatField || availableCols[0] || ''
  // Switching to a combined chart with no layers yet auto-seeds layers from the
  // current value fields (first = bar/left, rest = line/right), so a combo can
  // be built in the UI without importing a template.
  const handleChartTypeChange = (newType: string) => {
    update({ chartConfig: { ...chartCc, type: newType } })
    if (newType === 'mixed'
      && (widgetLayersMap[widget.id] || []).length === 0
      && chartEffFields.length > 0) {
      initLayersFromFields(widget, chartEffFields)
        .then(layers => setWidgetLayers(widget.id, layers))
        .catch(() => { /* layers can still be added manually */ })
    }
  }
  const chartOptions: OptionDef[] = isChart ? [
    {
      id: 'chart_type', category: 'chart', nameKey: 'charts.select_type',
      render: () => (
        <>
          <select
            value={chartCc.type as string || 'bar'}
            onChange={e => handleChartTypeChange(e.target.value)}
            className="input text-sm"
          >
            {CHART_TYPES.map(ct => (
              <option key={ct} value={ct}>{t(`charts.type.${ct}`, ct.charAt(0).toUpperCase() + ct.slice(1))}</option>
            ))}
          </select>
          {chartHasLayers && (
            <p className="text-[10px] text-slate-400 mt-1">{t('designer.chart_type_combined')}</p>
          )}
        </>
      ),
    },
    {
      id: 'legend_position', category: 'chart', nameKey: 'designer.legend_position', editor: 'select',
      get: c => (c.cc.legendPosition as string) || 'auto',
      set: (c, v) => c.update({ chartConfig: { ...c.cc, legendPosition: v as string } }),
      selectOptions: () => [
        { value: 'auto', nameKey: 'designer.legend_position.auto' },
        { value: 'top', nameKey: 'designer.legend_position.top' },
        { value: 'bottom', nameKey: 'designer.legend_position.bottom' },
        { value: 'left', nameKey: 'designer.legend_position.left' },
        { value: 'right', nameKey: 'designer.legend_position.right' },
        { value: 'hidden', nameKey: 'designer.legend_position.hidden' },
      ],
    },
    {
      id: 'null_handling', category: 'chart', nameKey: 'designer.null_handling', editor: 'select',
      get: c => (c.cc.nullHandling as string) || 'zero',
      set: (c, v) => c.update({ chartConfig: { ...c.cc, nullHandling: v as string } }),
      selectOptions: () => [
        { value: 'zero', nameKey: 'designer.null_handling.zero' },
        { value: 'gap', nameKey: 'designer.null_handling.gap' },
      ],
    },
    {
      id: 'category_field', category: 'data', nameKey: 'designer.category_field',
      showIf: () => availableCols.length > 0,
      render: () => (
        <select
          value={(chartCc.categoryField as string) || ''}
          onChange={e => {
            const { valueFields: _drop, ...rest } = chartCc
            update({ chartConfig: { ...rest, categoryField: e.target.value || undefined } })
          }}
          className="input text-sm"
        >
          <option value="">{t('designer.auto_first_column')}</option>
          {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ),
    },
    {
      id: 'value_fields', category: 'data', nameKey: 'designer.value_fields',
      hintKey: 'designer.value_fields_hint',
      showIf: () => !chartHasLayers && availableCols.length > 0,
      render: () => (
        <>
          <div className="flex items-center gap-1 mb-1">
            <button onClick={() => { const { valueFields: _d, ...rest } = chartCc; update({ chartConfig: rest }) }}
              className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5" title={t('designer.select_all')}>
              <CheckSquare className="w-3 h-3" /> {t('designer.select_all')}
            </button>
            <button onClick={() => update({ chartConfig: { ...chartCc, valueFields: [] } })}
              className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5" title={t('designer.deselect_all')}>
              <Square className="w-3 h-3" /> {t('designer.deselect_all')}
            </button>
            <button onClick={() => {
              const inverted = chartAllNonCat.filter(c => !chartEffFields.includes(c))
              if (inverted.length === chartAllNonCat.length) { const { valueFields: _d, ...rest } = chartCc; update({ chartConfig: rest }) }
              else update({ chartConfig: { ...chartCc, valueFields: inverted } })
            }} className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5" title={t('designer.invert')}>
              <ToggleLeft className="w-3 h-3" /> {t('designer.invert')}
            </button>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
            {chartAllNonCat.map((col, idx) => {
              const optColors = (chartCc.option as Record<string, unknown> | undefined)?.color
              const currentColor = Array.isArray(optColors) && typeof optColors[idx] === 'string' ? (optColors[idx] as string) : ''
              const setColor = (hex: string) => {
                const option = (chartCc.option as Record<string, unknown> | undefined) || {}
                const arr = Array.isArray(option.color) ? [...(option.color as unknown[])] : []
                while (arr.length <= idx) arr.push('')
                arr[idx] = hex
                update({ chartConfig: { ...chartCc, option: { ...option, color: arr } } })
              }
              return (
                <div key={col} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-800 dark:hover:text-white flex-1">
                    <input type="checkbox" checked={chartAllSelected || chartValFields.includes(col)}
                      onChange={() => toggleValueField(col)} className="rounded border-slate-300" />
                    {col}
                  </label>
                  <input type="color" value={currentColor || '#5470c6'} onChange={e => setColor(e.target.value)}
                    title={t('designer.series_color')} className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent" />
                  <input type="text" value={currentColor}
                    onChange={e => { const v = e.target.value.trim(); if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) setColor(v.toLowerCase()); else if (v === '') setColor('') }}
                    placeholder="#hex" maxLength={7}
                    className="w-16 font-mono text-[10px] px-1 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50" />
                </div>
              )
            })}
          </div>
        </>
      ),
    },
    {
      id: 'regression_lines', category: 'data', nameKey: 'designer.regression_lines',
      hintKey: 'designer.regression_lines_hint',
      showIf: () => !chartHasLayers && availableCols.length > 0,
      render: () => (
        <div className="space-y-1 max-h-28 overflow-y-auto border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
          {chartEffFields.map(col => (
            <label key={col} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-800 dark:hover:text-white">
              <input type="checkbox" checked={Array.isArray(chartRegFields) && chartRegFields.includes(col)}
                onChange={() => toggleRegressionField(col)} className="rounded border-slate-300" />
              {col}
            </label>
          ))}
        </div>
      ),
    },
    {
      id: 'axis_options', category: 'axis', nameKey: 'designer.chart_axis_options',
      showIf: () => !chartHasLayers && ['bar', 'line', 'area'].includes((chartCc.type as string) || 'bar'),
      render: () => (
        <div className="space-y-1.5">
          {chartCc.type === 'bar' && (
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={chartCc.orientation === 'horizontal'}
                onChange={e => update({ chartConfig: { ...chartCc, orientation: e.target.checked ? 'horizontal' : undefined } })}
                className="h-3.5 w-3.5" />
              <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_orientation_horizontal')}</span>
            </label>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={!!chartCc.stacked}
              onChange={e => update({ chartConfig: { ...chartCc, stacked: e.target.checked || undefined } })}
              className="h-3.5 w-3.5" />
            <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_stacked')}</span>
          </label>
        </div>
      ),
    },
    {
      id: 'y_axis_format', category: 'axis', nameKey: 'designer.y_axis_format', editor: 'select',
      showIf: () => !chartHasLayers && AXIS_CHART_TYPES.includes((chartCc.type as string) || 'bar'),
      get: c => (c.cc.yAxisFormat as string) || 'plain',
      set: (c, v) => c.update({ chartConfig: { ...c.cc, yAxisFormat: v as string } }),
      selectOptions: () => [
        { value: 'plain', nameKey: 'designer.axis_format.plain' },
        { value: 'thousands', nameKey: 'designer.axis_format.thousands' },
        { value: 'millions', nameKey: 'designer.axis_format.millions' },
        { value: 'billions', nameKey: 'designer.axis_format.billions' },
        { value: 'currency', nameKey: 'designer.axis_format.currency' },
        { value: 'percent', nameKey: 'designer.axis_format.percent' },
      ],
    },
    {
      id: 'y_axis_decimals', category: 'axis', nameKey: 'designer.y_axis_decimals', editor: 'number',
      showIf: () => !chartHasLayers && AXIS_CHART_TYPES.includes((chartCc.type as string) || 'bar')
        && ['plain', 'thousands', 'millions', 'billions', 'currency', 'percent'].includes((chartCc.yAxisFormat as string) || 'plain'),
      get: c => c.cc.yAxisDecimals != null ? Number(c.cc.yAxisDecimals) : undefined,
      set: (c, v) => c.update({ chartConfig: { ...c.cc, yAxisDecimals: v } }),
    },
    {
      id: 'y_axis_currency', category: 'axis', nameKey: 'designer.currency',
      showIf: () => !chartHasLayers && chartCc.yAxisFormat === 'currency',
      render: () => (
        <select value={chartCc.yAxisCurrency as string || 'USD'}
          onChange={e => update({ chartConfig: { ...chartCc, yAxisCurrency: e.target.value } })}
          className="input text-sm">
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
        </select>
      ),
    },
    {
      id: 'y_axis_min', category: 'axis', nameKey: 'designer.y_axis_min', editor: 'select',
      showIf: () => !chartHasLayers && AXIS_CHART_TYPES.includes((chartCc.type as string) || 'bar'),
      get: c => (c.cc.yAxisMin as string) || 'zero',
      set: (c, v) => c.update({ chartConfig: { ...c.cc, yAxisMin: v as string } }),
      selectOptions: () => [
        { value: 'zero', nameKey: 'designer.y_axis_min.zero' },
        { value: 'auto', nameKey: 'designer.y_axis_min.auto' },
      ],
    },
    {
      id: 'x_axis_rotation', category: 'axis', nameKey: 'designer.x_axis_rotation', editor: 'select',
      showIf: () => AXIS_CHART_TYPES.includes((chartCc.type as string) || 'bar'),
      get: c => String((c.cc.xAxisRotation as number) || 0),
      set: (c, v) => c.update({ chartConfig: { ...c.cc, xAxisRotation: Number(v) } }),
      selectOptions: () => [
        { value: '0', nameKey: 'designer.rotation.horizontal' },
        { value: '45', nameKey: 'designer.rotation.angled' },
        { value: '90', nameKey: 'designer.rotation.vertical' },
      ],
    },
    {
      id: 'data_labels', category: 'labels', nameKey: '',
      showIf: () => !chartHasLayers,
      render: () => (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={!!chartCc.showDataLabels}
              onChange={e => update({ chartConfig: { ...chartCc, showDataLabels: e.target.checked } })}
              className="rounded border-slate-300" />
            {t('designer.show_data_labels')}
          </label>
          {!!chartCc.showDataLabels && (
            <div className="mt-2 space-y-2">
              <select value={chartCc.dataLabelPosition as string || 'top'}
                onChange={e => update({ chartConfig: { ...chartCc, dataLabelPosition: e.target.value } })}
                className="input text-sm">
                <option value="top">{t('designer.data_label_position.top')}</option>
                <option value="inline">{t('designer.data_label_position.inline')}</option>
              </select>
              <select value={chartCc.dataLabelMode as string || 'all'}
                onChange={e => update({ chartConfig: { ...chartCc, dataLabelMode: e.target.value } })}
                className="input text-sm">
                <option value="all">{t('designer.label_mode.all')}</option>
                <option value="first">{t('designer.label_mode.first_n')}</option>
                <option value="last">{t('designer.label_mode.last_n')}</option>
                <option value="min_max">{t('designer.label_mode.min_max')}</option>
              </select>
              {(chartCc.dataLabelMode === 'first' || chartCc.dataLabelMode === 'last') && (
                <NumericInput value={chartCc.dataLabelCount as number || 3}
                  onChange={v => update({ chartConfig: { ...chartCc, dataLabelCount: v ?? 3 } })}
                  className="input text-sm" placeholder={t('designer.label_count_placeholder')} />
              )}
              <select value={chartCc.dataLabelTopSpacingMode as string || 'dynamic'}
                onChange={e => update({ chartConfig: { ...chartCc, dataLabelTopSpacingMode: e.target.value } })}
                className="input text-sm">
                <option value="dynamic">{t('designer.label_top_spacing_mode.dynamic')}</option>
                <option value="fixed">{t('designer.label_top_spacing_mode.fixed')}</option>
              </select>
              <div className="flex items-center gap-2">
                <NumericInput value={chartCc.dataLabelDecimals != null ? Number(chartCc.dataLabelDecimals) : 1}
                  onChange={v => update({ chartConfig: { ...chartCc, dataLabelDecimals: v ?? 1 } })}
                  className="input text-sm w-16" />
                <span className="text-xs text-slate-500 dark:text-slate-400">{t('designer.data_label_decimals')}</span>
              </div>
              <div className="flex items-center gap-2">
                <NumericInput value={chartCc.dataLabelFontSize != null ? Number(chartCc.dataLabelFontSize) : 10}
                  onChange={v => update({ chartConfig: { ...chartCc, dataLabelFontSize: v ?? undefined } })}
                  className="input text-sm w-16" />
                <span className="text-xs text-slate-500 dark:text-slate-400">{t('designer.data_label_font_size')}</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={chartCc.dataLabelThousandsSep !== false}
                  onChange={e => update({ chartConfig: { ...chartCc, dataLabelThousandsSep: e.target.checked } })}
                  className="rounded border-slate-300" />
                {t('designer.data_label_thousands_sep')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={!!chartCc.dataLabelBoxed}
                  onChange={e => update({ chartConfig: { ...chartCc, dataLabelBoxed: e.target.checked } })}
                  className="rounded border-slate-300" />
                {t('designer.data_label_boxed')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={!!chartCc.dataLabelSpread}
                  onChange={e => update({ chartConfig: { ...chartCc, dataLabelSpread: e.target.checked } })}
                  className="rounded border-slate-300" />
                {t('designer.data_label_spread')}
              </label>
              <select value={String(chartCc.dataLabelRotation || 0)}
                onChange={e => update({ chartConfig: { ...chartCc, dataLabelRotation: Number(e.target.value) } })}
                className="input text-sm">
                <option value="0">{t('designer.label_rotation.horizontal')}</option>
                <option value="-45">{t('designer.label_rotation.angled_up')}</option>
                <option value="45">{t('designer.label_rotation.angled_down')}</option>
                <option value="-90">{t('designer.label_rotation.vertical')}</option>
              </select>
            </div>
          )}
        </>
      ),
    },
    {
      // Per-layer accordion (mixed / multi-series charts). Each layer carries
      // its own color/type/axis/labels/markers. Shown when the chart has layers
      // or is combined, so layers can be added from scratch.
      id: 'layers', category: 'layers', nameKey: '',
      showIf: () => chartHasLayers,
      render: () => <LayerSettingsAccordion widget={widget} cc={chartCc} update={update}
        availableCols={availableCols} categoryField={chartEffCat} />,
    },
    {
      // Threshold lines / min-max markers / conditional color / delta / last-
      // point highlight. Each control self-gates on chart type; the section is
      // shown for axis-based (non-pie, non-mixed) charts.
      id: 'markers', category: 'markers', nameKey: '',
      showIf: () => AXIS_CHART_TYPES.includes((chartCc.type as string) || 'bar'),
      render: () => <ChartMarkerOptions cc={chartCc} update={update} availableCols={availableCols} />,
    },
    {
      id: 'pie', category: 'pie', nameKey: '',
      showIf: () => ((chartCc.type as string) || 'bar') === 'pie',
      render: () => <ChartPieOptions cc={chartCc} update={update} availableCols={availableCols} previewRows={previewRows} />,
    },
  ] : []

  // Widget-type specific config (TABLE/KPI/FILTER/TEXT) lives in its own
  // registry group so each type contributes one collapsible section.
  const isTable = widget.widgetType === 'TABLE'
  const isKpi = widget.widgetType === 'KPI'
  const isFilter = widget.widgetType === 'FILTER'
  const widgetTypeOptions: OptionDef[] = [
    ...(isTable ? [{
      id: 'table_config', category: 'table', nameKey: '',
      showIf: () => availableCols.length > 0,
      render: () => <TableConfigOptions widget={widget} cc={chartCc} update={update} availableCols={availableCols} previewRows={previewRows} />,
    }] : []),
    ...(isKpi ? [{
      id: 'kpi_config', category: 'kpi', nameKey: '',
      render: () => <KpiConfigOptions cc={chartCc} update={update} availableCols={availableCols} />,
    }] : []),
    ...(isFilter ? [{
      id: 'filter_config', category: 'filter', nameKey: '',
      showIf: () => availableCols.length > 0,
      render: () => <FilterConfigOptions cc={chartCc} update={update} availableCols={availableCols} />,
    }] : []),
  ]

  const registryOptions = [...COMMON_OPTIONS, ...dataSourceOptions, ...chartOptions, ...widgetTypeOptions]
  const registryCategories = [
    ...COMMON_CATEGORIES,
    ...(isDataBound ? [{ id: 'source', nameKey: 'designer.section_source' }] : []),
    ...(isChart ? [{ id: 'chart', nameKey: 'designer.section_chart' }] : []),
    ...(isChart ? [{ id: 'layers', nameKey: 'designer.section_layers' }] : []),
    ...(isChart ? [{ id: 'data', nameKey: 'designer.section_data' }] : []),
    ...(isChart ? [{ id: 'axis', nameKey: 'designer.section_axis' }] : []),
    ...(isChart ? [{ id: 'labels', nameKey: 'designer.section_labels' }] : []),
    ...(isChart ? [{ id: 'markers', nameKey: 'designer.section_markers' }] : []),
    ...(isChart ? [{ id: 'pie', nameKey: 'designer.section_pie' }] : []),
    ...(isTable ? [{ id: 'table', nameKey: 'designer.section_table' }] : []),
    ...(isKpi ? [{ id: 'kpi', nameKey: 'designer.section_kpi' }] : []),
    ...(isFilter ? [{ id: 'filter', nameKey: 'designer.section_filter' }] : []),
  ]

  return (
    <>
    <div className="p-3 space-y-4 overflow-y-auto">
      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={async () => {
          // Saved widget: duplicate on the server so all per-widget elements
          // (layers, annotations, tooltip, visibility rules) are copied. Unsaved
          // widget: client-side clone (it has no server-side elements yet).
          if (widget.serverId && reportId) {
            try {
              const w = await reportApi.duplicateWidget(widget.serverId)
              const newId = addServerWidget(w)
              const sid = (w.widgetId ?? w.id) as number
              try { setWidgetLayers(newId, await interactiveApi.getLayersForWidget(sid)) } catch { /* no layers */ }
            } catch {
              toast.error(t('common.error'))
            }
          } else {
            duplicateWidget(widget.id)
          }
        }} className="btn-ghost p-1.5" title={t('common.duplicate')}>
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={() => update({ isVisible: !widget.isVisible })}
          className="btn-ghost p-1.5" title={widget.isVisible ? t('designer.hide') : t('designer.show')}
        >
          {widget.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={() => { if (confirm(t('designer.delete_widget_confirm'))) removeWidget(widget.id) }}
          className="btn-ghost p-1.5 text-red-500" title={t('common.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-surface-100 dark:bg-dark-surface-100 rounded">
          {({
            CHART: t('widgets.type.chart'), TABLE: t('widgets.type.table'), KPI: t('widgets.type.kpi'),
            TEXT: t('widgets.type.text'), FILTER: t('widgets.type.filter'), IMAGE: t('widgets.type.image'),
            BUTTON: t('widgets.type.button'), WEBPAGE: t('widgets.type.webpage'),
            SPACER: t('widgets.type.spacer'), DIVIDER: t('widgets.type.divider'),
          } as Record<string, string>)[widget.widgetType] || widget.widgetType}
        </span>
      </div>

      {/* Common header fields (title, description, layout, z-index) are driven
          by the options registry - collapsible sections + an option search.
          Widget-type-specific config below is migrated to the registry in later
          phases. Title binds to widget.title for all types; for TEXT widgets the
          HTML body lives in chartConfig.content (JSONB, no length cap). */}
      <OptionsPane options={registryOptions} categories={registryCategories} ctx={optionsCtx} />

      {/* Data-bound widget config (CHART/TABLE/KPI/FILTER) is driven by the
          options registry above. The non-data widgets below (TEXT/IMAGE/
          BUTTON/...) keep their own inline editors. */}

      {/* Text content - stored in widget.body (dedicated TEXT column on the
          backend, no length limit). Title stays in widget.title for the
          widget's display name, like every other widget type. */}
      {widget.widgetType === 'TEXT' && (
        <Field label={t('designer.content_html')}>
          <textarea
            value={widget.body || ''}
            onChange={e => update({ body: e.target.value })}
            className="input text-sm h-32 resize-none font-mono"
            placeholder={t('designer.html_placeholder')}
          />
          <p className="text-[10px] text-slate-400 mt-1">{t('designer.title_interpolation_hint')}</p>
        </Field>
      )}

      {/* Image */}
      {widget.widgetType === 'IMAGE' && (
        <Field label={t('designer.image_url')}>
          <input
            value={(widget.chartConfig as Record<string, unknown>).src as string || (widget.chartConfig as Record<string, unknown>).url as string || ''}
            onChange={e => update({ chartConfig: { ...widget.chartConfig, src: e.target.value, url: e.target.value } })}
            className="input text-sm" placeholder="https://..."
          />
        </Field>
      )}

      {/* Button */}
      {widget.widgetType === 'BUTTON' && (() => {
        const bc = (widget.chartConfig || {}) as Record<string, unknown>
        const updateBtn = (updates: Record<string, unknown>) => update({ chartConfig: { ...bc, ...updates } })
        // Ensure buttonType is always saved
        if (!bc.buttonType) updateBtn({ buttonType: 'SHOW_HIDE' })
        const effectiveType = (bc.buttonType as string) || 'SHOW_HIDE'
        return (
          <>
            <Field label={t('designer.button_type')}>
              <select value={effectiveType} onChange={e => updateBtn({ buttonType: e.target.value })} className="input text-sm">
                <option value="SHOW_HIDE">{t('designer.button_show_hide')}</option>
                <option value="NAVIGATE">{t('designer.button_navigate')}</option>
                <option value="FILTER">{t('designer.button_filter')}</option>
                <option value="URL">{t('designer.button_url')}</option>
                <option value="EXPORT">{t('designer.button_export')}</option>
              </select>
            </Field>
            <Field label={t('designer.button_label')}>
              <input value={bc.label as string || ''} onChange={e => updateBtn({ label: e.target.value })} className="input text-sm" placeholder={t('designer.button_label')} />
            </Field>
            {(bc.buttonType === 'SHOW_HIDE' || !bc.buttonType) && (
              <Field label={t('designer.button_label_active')}>
                <input value={bc.labelActive as string || ''} onChange={e => updateBtn({ labelActive: e.target.value })} className="input text-sm" placeholder={t('designer.button_label_active')} />
              </Field>
            )}
            <Field label={t('designer.button_size')}>
              <select value={bc.size as string || 'medium'} onChange={e => updateBtn({ size: e.target.value })} className="input text-sm">
                <option value="small">{t('designer.button_small')}</option>
                <option value="medium">{t('designer.button_medium')}</option>
                <option value="large">{t('designer.button_large')}</option>
              </select>
            </Field>
            <Field label={t('designer.button_color')}>
              <select value={bc.color as string || 'brand'} onChange={e => updateBtn({ color: e.target.value })} className="input text-sm">
                <option value="brand">Brand</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="orange">Orange</option>
                <option value="slate">Slate</option>
              </select>
            </Field>
            {(bc.buttonType === 'SHOW_HIDE' || !bc.buttonType) && (
              <Field label={t('designer.button_toggle_ids')}>
                <select
                  value={(bc.toggleWidgetIds as number[] || [])[0] || ''}
                  onChange={e => updateBtn({ toggleWidgetIds: e.target.value ? [Number(e.target.value)] : [] })}
                  className="input text-sm"
                >
                  <option value="">{t('designer.button_select_widget')}</option>
                  {widgets.filter(w => w.id !== widget.id && w.serverId).map(w => (
                    <option key={w.serverId} value={w.serverId}>{w.title || `Widget #${w.serverId}`}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">{t('designer.button_toggle_hint')}</p>
              </Field>
            )}
            {bc.buttonType === 'NAVIGATE' && (
              <Field label={t('designer.button_target_report')}>
                <NumericInput
                  value={bc.targetReportId as number | undefined}
                  onChange={v => updateBtn({ targetReportId: v })}
                  className="input text-sm"
                  placeholder="Report ID"
                />
              </Field>
            )}
            {bc.buttonType === 'URL' && (
              <Field label="URL">
                <input value={bc.url as string || ''} onChange={e => updateBtn({ url: e.target.value })} className="input text-sm" placeholder="https://..." />
              </Field>
            )}
            {bc.buttonType === 'FILTER' && (
              <>
                <Field label={t('interactive.action.source_field')}>
                  <input value={bc.filterField as string || ''} onChange={e => updateBtn({ filterField: e.target.value })} className="input text-sm" />
                </Field>
                <Field label={t('designer.button_filter_value')}>
                  <input value={bc.filterValue as string || ''} onChange={e => updateBtn({ filterValue: e.target.value })} className="input text-sm" />
                </Field>
              </>
            )}
          </>
        )
      })()}
    </div>

    {sqlEditorOpen && widget && createPortal(
      <SqlEditorModal
        sql={widget.rawSql}
        datasourceId={widget.datasourceId}
        parameters={parameters}
        onSave={(newSql) => { update({ rawSql: newSql, queryId: null }); setSqlEditorOpen(false) }}
        onClose={() => setSqlEditorOpen(false)}
      />,
      document.body
    )}
    </>
  )
}

function ParamMappingEditor({
  mapping, onChange, parameters, widgets,
}: {
  mapping: Record<string, string>
  onChange: (m: Record<string, string>) => void
  parameters: Array<{ name: string; label: string }>
  widgets: DesignerWidget[]
}) {
  const { t } = useTranslation()
  const entries = Object.entries(mapping)

  // Suggest report-param names: explicit parameters + filterColumn from all FILTER widgets
  const reportParamNames = useMemo(() => {
    const names = new Set<string>()
    parameters.forEach(p => names.add(p.name))
    widgets.forEach(w => {
      if (w.widgetType === 'FILTER') {
        const col = (w.chartConfig as Record<string, unknown>).filterColumn as string | undefined
        if (col) names.add(col)
      }
    })
    return [...names].sort()
  }, [parameters, widgets])

  const handleAdd = () => onChange({ ...mapping, '': '' })
  const handleRemove = (key: string) => {
    const next = { ...mapping }
    delete next[key]
    onChange(next)
  }
  const handleChangeKey = (oldKey: string, newKey: string) => {
    // Rebuild to preserve order
    const next: Record<string, string> = {}
    for (const [k, v] of entries) {
      next[k === oldKey ? newKey : k] = v
    }
    onChange(next)
  }
  const handleChangeValue = (key: string, newVal: string) => {
    onChange({ ...mapping, [key]: newVal })
  }

  return (
    <div className="border border-dashed border-violet-300 dark:border-violet-700 rounded-lg p-2.5 bg-violet-50/50 dark:bg-violet-900/10">
    <Field label={t('designer.param_mapping')}>
      <p className="text-[10px] text-slate-400 mb-2">{t('designer.param_mapping_hint')}</p>
      {entries.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {entries.map(([key, val], i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={key}
                onChange={e => handleChangeKey(key, e.target.value)}
                placeholder={t('designer.param_mapping_query_param')}
                className="input text-xs py-0.5 flex-1 min-w-0"
              />
              <span className="text-[10px] text-slate-400">{'->'}</span>
              <select
                value={reportParamNames.includes(val) ? val : '__custom__'}
                onChange={e => {
                  if (e.target.value === '__custom__') return
                  handleChangeValue(key, e.target.value)
                }}
                className="input text-xs py-0.5 flex-1 min-w-0"
              >
                {!reportParamNames.includes(val) && val && (
                  <option value="__custom__">{val}</option>
                )}
                <option value="">{t('designer.param_mapping_report_param')}</option>
                {reportParamNames.map((n: string) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <input
                value={val}
                onChange={e => handleChangeValue(key, e.target.value)}
                placeholder={t('designer.param_mapping_report_param')}
                className="input text-xs py-0.5 flex-1 min-w-0"
              />
              <button onClick={() => handleRemove(key)} className="btn-ghost p-0.5 text-red-400 hover:text-red-500 flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button onClick={handleAdd} className="btn-ghost text-[11px] gap-1 text-brand-500">
        <Plus className="w-3 h-3" /> {t('designer.param_mapping_add')}
      </button>
    </Field>
    </div>
  )
}

function SqlEditorModal({ sql, datasourceId, parameters, onSave, onClose }: {
  sql: string
  datasourceId: number | null
  parameters: Array<{ name: string; paramType: string; defaultValue: string }>
  onSave: (sql: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [editSql, setEditSql] = useState(sql)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number; executionMs: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExecute = useCallback(async () => {
    if (!datasourceId || !editSql.trim()) return
    setExecuting(true)
    setError(null)
    try {
      const paramValues = buildDesignerParameterValues(parameters)
      const merged = mergeSqlParameterKeys(editSql, paramValues)
      const res = await queryApi.executeAdHoc({ datasourceId, sql: editSql, parameters: merged, limit: 100 })
      const cols = (res.columns || []).map((c: string | { name: string }) => typeof c === 'string' ? c : c.name)
      setResult({ columns: cols, rows: res.rows || [], rowCount: res.rowCount || res.rows?.length || 0, executionMs: res.executionTimeMs || 0 })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('widget_menu.execute_failed'))
    } finally {
      setExecuting(false)
    }
  }, [datasourceId, editSql, parameters, t])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); e.stopPropagation(); onSave(editSql) }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose, onSave, editSql])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl flex flex-col m-4" style={{ width: 'calc(100vw - 80px)', height: 'calc(100vh - 80px)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">{t('designer.sql_editor')}</h3>
          <div className="flex items-center gap-2">
            {datasourceId && (
              <button onClick={handleExecute} disabled={executing} className="btn-secondary text-xs px-2.5 py-1.5">
                <Play className="w-3.5 h-3.5" />
                {executing ? t('widget_menu.executing') : t('widget_menu.execute')}
              </button>
            )}
            <button onClick={() => onSave(editSql)} className="btn-primary text-xs px-3 py-1.5">{t('common.save')}</button>
            <button onClick={onClose} className="btn-secondary text-xs px-3 py-1.5">{t('common.cancel')}</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 border-b border-surface-200 dark:border-dark-surface-100" style={{ minHeight: '250px' }}>
          <SqlCodeEditor
            value={editSql}
            onChange={setEditSql}
            onExecute={handleExecute}
          />
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
                      <td key={col} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[300px] truncate">{row[col] != null ? String(row[col]) : ''}</td>
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

/**
 * Inline row to add a new (value, colour) pair to rowColorBy/colorBy maps.
 * Useful when the preview sample doesn't surface all possible values
 * (e.g. sort order hides some categories past the sample limit).
 */
export function AddColorValueRow({
  existingValues,
  defaultColor,
  onAdd,
  placeholder,
}: {
  existingValues: string[]
  defaultColor: string
  onAdd: (value: string, hex: string) => void
  placeholder: string
}) {
  const [value, setValue] = useState('')
  const [color, setColor] = useState(defaultColor)
  const commit = () => {
    const v = value.trim()
    if (!v) return
    if (existingValues.includes(v)) return // already configured
    onAdd(v, color)
    setValue('')
  }
  return (
    <div className="flex items-center gap-2 text-xs pt-1 border-t border-surface-100 dark:border-dark-surface-100">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        placeholder={placeholder}
        className="flex-1 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
      />
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
      />
      <input
        type="text"
        value={color}
        onChange={e => {
          const v = e.target.value.trim()
          if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) setColor(v.toLowerCase())
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        placeholder="#hex"
        maxLength={7}
        className="w-16 font-mono text-[10px] px-1 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
      />
      <button
        onClick={commit}
        disabled={!value.trim()}
        className="text-brand-500 hover:text-brand-700 disabled:text-slate-300 disabled:cursor-not-allowed text-base leading-none"
        title={placeholder}
      >+</button>
    </div>
  )
}

/**
 * Reusable editor for an array of color stops { at: number, color: hex }.
 * Used by KPI cards (colorMode/colorStops), chart highlightLastPoint, and
 * table heatmap formatters. Hex is editable both via native color picker and
 * a free-form text input so users can paste exact brand colors.
 */
export function ColorStopsEditor({ stops, onChange, addLabel }: {
  stops: Array<{ at: number; color: string }>
  onChange: (next: Array<{ at: number; color: string }>) => void
  addLabel: string
}) {
  const updateStop = (idx: number, patch: Partial<{ at: number; color: string }>) => {
    const next = [...stops]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  return (
    <div className="space-y-1">
      {stops.map((stop, idx) => (
        <div key={idx} className="flex items-center gap-1.5 text-xs">
          <NumericInput
            value={stop.at}
            onChange={v => updateStop(idx, { at: v ?? 0 })}
            className="flex-1 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
            placeholder="at"
          />
          <input
            type="color"
            value={stop.color}
            onChange={e => updateStop(idx, { color: e.target.value })}
            className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={stop.color}
            onChange={e => updateStop(idx, { color: e.target.value })}
            className="w-16 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50 font-mono"
            placeholder="#hex"
          />
          <button
            onClick={() => onChange(stops.filter((_, i) => i !== idx))}
            className="text-red-500 hover:text-red-700 p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...stops, { at: stops.length ? stops[stops.length - 1].at + 0.1 : 0, color: '#888888' }])}
        className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5"
      >
        <Plus className="w-3 h-3" /> {addLabel}
      </button>
    </div>
  )
}
