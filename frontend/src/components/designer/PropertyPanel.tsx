import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { SavedQuery, DataSource } from '@/types'
import { queryApi } from '@/api/queries'
import { datasourceApi } from '@/api/datasources'
import { interactiveApi } from '@/api/interactive'
import type { ChartLayerItem } from '@/types'
import { buildDesignerParameterValues, mergeSqlParameterKeys } from '@/utils/designerParameters'
import { Trash2, Copy, Eye, EyeOff, RefreshCw, CheckSquare, Square, ToggleLeft, ArrowUp, ArrowDown, Plus, X, MoreVertical, Play, ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import SqlCodeEditor from '@/components/common/SqlCodeEditor'
import NumericInput from '@/components/common/NumericInput'
import { CHART_TYPE_OPTIONS } from '@/components/charts/chartTypeBuilders'
import OptionsPane from '@/components/designer/options/OptionsPane'
import { COMMON_OPTIONS, COMMON_CATEGORIES } from '@/components/designer/options/commonOptions'
import type { OptionCtx, OptionDef } from '@/components/designer/options/types'
import toast from 'react-hot-toast'

// Single source of truth for chart-type values comes from chartTypeBuilders;
// this used to be a separate hand-maintained list that diverged - users could
// not pick horizontal_bar / stacked_bar / stacked_area through the UI even
// though the chart engine handled them.
const CHART_TYPES = CHART_TYPE_OPTIONS.map(o => o.value)

const CURRENCIES = [
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
  const widgetLayersMap = useDesignerStore(s => s.widgetLayers)
  const updateWidgetLayer = useDesignerStore(s => s.updateWidgetLayer)
  const setWidgetLayers = useDesignerStore(s => s.setWidgetLayers)

  const [expandedLayerIds, setExpandedLayerIds] = useState<Set<number>>(new Set())
  const toggleLayerExpand = (id: number) =>
    setExpandedLayerIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

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
  const chartOptions: OptionDef[] = isChart ? [
    {
      id: 'chart_type', category: 'chart', nameKey: 'charts.select_type',
      render: () => (
        <>
          <select
            value={chartCc.type as string || 'bar'}
            onChange={e => update({ chartConfig: { ...chartCc, type: e.target.value } })}
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
  ] : []

  const registryOptions = [...COMMON_OPTIONS, ...dataSourceOptions, ...chartOptions]
  const registryCategories = [
    ...COMMON_CATEGORIES,
    ...(isDataBound ? [{ id: 'source', nameKey: 'designer.section_source' }] : []),
    ...(isChart ? [{ id: 'chart', nameKey: 'designer.section_chart' }] : []),
    ...(isChart ? [{ id: 'data', nameKey: 'designer.section_data' }] : []),
    ...(isChart ? [{ id: 'axis', nameKey: 'designer.section_axis' }] : []),
  ]

  return (
    <>
    <div className="p-3 space-y-4 overflow-y-auto">
      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={() => duplicateWidget(widget.id)} className="btn-ghost p-1.5" title={t('common.duplicate')}>
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

      {/* Widget-type config. The data source and param mapping fields live in
          the options registry above (Источник данных section); this block holds
          the per-type config (CHART/TABLE/KPI/FILTER). */}
      {!['IMAGE', 'BUTTON', 'SPACER', 'DIVIDER', 'WEBPAGE'].includes(widget.widgetType) && (() => {
        const cc = widget.chartConfig as Record<string, unknown>

        return (
          <>
            {/* ── CHART Config ── */}
            {widget.widgetType === 'CHART' && (() => {
              const isMixed = cc.type === 'mixed'
              const hasLayers = (widgetLayersMap[widget.id] || []).length > 0 || isMixed

              return (
                <>

                  {/* Layer settings accordion — shown for mixed type or when layers exist */}
                  {hasLayers && (() => {
                    const layers = widgetLayersMap[widget.id] || []
                    // Helpers: axis-specific chartConfig keys (left = base key, right = key + "Right")
                    const axisKey = (axis: string, suffix: string) =>
                      axis === 'right' ? `yAxis${suffix}Right` : `yAxis${suffix}`
                    const getAxisVal = (axis: string, suffix: string, def: unknown) =>
                      (cc[axisKey(axis, suffix)] ?? def)
                    const setAxisVal = (axis: string, suffix: string, val: unknown) =>
                      update({ chartConfig: { ...cc, [axisKey(axis, suffix)]: val } })

                    const patchLayer = async (layer: ChartLayerItem, patch: Partial<ChartLayerItem>) => {
                      try { await interactiveApi.updateLayer(layer.id, { ...layer, ...patch }) } catch { /* silent */ }
                      updateWidgetLayer(widget.id, layer.id, patch)
                    }
                    const patchSeriesConfig = async (layer: ChartLayerItem, patch: Record<string, unknown>) => {
                      const sc = { ...(layer.seriesConfig as Record<string, unknown> || {}), ...patch }
                      await patchLayer(layer, { seriesConfig: sc })
                    }

                    return (
                      <div className="space-y-1 mb-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                          {t('designer.layers')}
                        </p>
                        {layers.map((layer: ChartLayerItem) => {
                          const expanded = expandedLayerIds.has(layer.id)
                          const sc = layer.seriesConfig as Record<string, unknown> || {}
                          const labelShow = !!(sc.label as Record<string, unknown> | undefined)?.show
                          const labelPos = ((sc.label as Record<string, unknown> | undefined)?.position as string) || 'top'
                          const axFmt = getAxisVal(layer.axis, 'Format', 'plain') as string
                          const axMin = getAxisVal(layer.axis, 'Min', 'zero') as string
                          const axDec = getAxisVal(layer.axis, 'Decimals', undefined) as number | undefined
                          const axCur = getAxisVal(layer.axis, 'Currency', 'USD') as string

                          return (
                            <div key={layer.id} className="border border-surface-200 dark:border-dark-surface-100 rounded-lg overflow-hidden">
                              {/* Accordion header */}
                              <button
                                type="button"
                                onClick={() => toggleLayerExpand(layer.id)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-dark-surface-50 text-left"
                              >
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: layer.color || '#5470c6' }} />
                                <span className="text-xs flex-1 truncate text-slate-700 dark:text-slate-300">{layer.label || layer.name}</span>
                                <span className="text-[10px] text-slate-400">{layer.chartType} / {layer.axis}</span>
                                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                              </button>

                              {/* Accordion body */}
                              {expanded && (
                                <div className="px-2 pb-2 pt-1 space-y-2 border-t border-surface-200 dark:border-dark-surface-100 bg-surface-50/50 dark:bg-dark-surface-50/50">

                                  {/* Color */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{t('designer.series_color')}</span>
                                    <input type="color" value={layer.color || '#5470c6'}
                                      onChange={e => patchLayer(layer, { color: e.target.value })}
                                      className="w-6 h-6 border-0 rounded cursor-pointer bg-transparent" />
                                    <input type="text" value={layer.color || ''}
                                      onChange={e => { if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e.target.value)) patchLayer(layer, { color: e.target.value.toLowerCase() }) }}
                                      placeholder="#hex" maxLength={7}
                                      className="w-16 font-mono text-[10px] px-1 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50" />
                                  </div>

                                  {/* Chart type */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{t('designer.chart_type')}</span>
                                    <select value={layer.chartType}
                                      onChange={e => patchLayer(layer, { chartType: e.target.value })}
                                      className="input text-xs flex-1">
                                      <option value="bar">{t('designer.layer_type.bar')}</option>
                                      <option value="line">{t('designer.layer_type.line')}</option>
                                      <option value="area">{t('designer.layer_type.area')}</option>
                                    </select>
                                  </div>

                                  {/* Axis */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{t('designer.y_axis')}</span>
                                    <select value={layer.axis}
                                      onChange={e => patchLayer(layer, { axis: e.target.value })}
                                      className="input text-xs flex-1">
                                      <option value="left">{t('designer.layer_axis.left')}</option>
                                      <option value="right">{t('designer.layer_axis.right')}</option>
                                    </select>
                                  </div>

                                  {/* Opacity */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{t('designer.opacity')}</span>
                                    <input type="range" min={0} max={1} step={0.05}
                                      value={layer.opacity ?? 1}
                                      onChange={e => patchLayer(layer, { opacity: Number(e.target.value) })}
                                      className="flex-1" />
                                    <span className="text-[10px] text-slate-400 w-8 text-right">{Math.round((layer.opacity ?? 1) * 100)}%</span>
                                  </div>

                                  {/* Smoothing (line/area only) */}
                                  {(layer.chartType === 'line' || layer.chartType === 'area') && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{t('designer.smooth')}</span>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox"
                                          checked={sc.smooth !== false}
                                          onChange={e => patchSeriesConfig(layer, { smooth: e.target.checked })}
                                          className="rounded border-slate-300" />
                                        <span className="text-xs text-slate-600 dark:text-slate-300">{t('designer.enabled')}</span>
                                      </label>
                                    </div>
                                  )}

                                  {/* Y-axis format (per-axis, shown with axis label) */}
                                  <div className="pt-1 border-t border-surface-200 dark:border-dark-surface-100">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">
                                      {t('designer.y_axis_settings')} ({layer.axis === 'right' ? t('designer.layer_axis.right') : t('designer.layer_axis.left')})
                                    </p>
                                    <div className="space-y-1.5">
                                      <select value={axFmt}
                                        onChange={e => setAxisVal(layer.axis, 'Format', e.target.value)}
                                        className="input text-xs w-full">
                                        <option value="plain">{t('designer.axis_format.plain')}</option>
                                        <option value="thousands">{t('designer.axis_format.thousands')}</option>
                                        <option value="millions">{t('designer.axis_format.millions')}</option>
                                        <option value="billions">{t('designer.axis_format.billions')}</option>
                                        <option value="currency">{t('designer.axis_format.currency')}</option>
                                        <option value="percent">{t('designer.axis_format.percent')}</option>
                                      </select>
                                      {axFmt === 'currency' && (
                                        <select value={axCur}
                                          onChange={e => setAxisVal(layer.axis, 'Currency', e.target.value)}
                                          className="input text-xs w-full">
                                          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
                                        </select>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 flex-shrink-0">{t('designer.y_axis_min')}</span>
                                        <select value={axMin}
                                          onChange={e => setAxisVal(layer.axis, 'Min', e.target.value)}
                                          className="input text-xs flex-1">
                                          <option value="zero">{t('designer.y_axis_min.zero')}</option>
                                          <option value="auto">{t('designer.y_axis_min.auto')}</option>
                                        </select>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 flex-shrink-0">{t('designer.y_axis_decimals')}</span>
                                        <NumericInput value={axDec} onChange={v => setAxisVal(layer.axis, 'Decimals', v)}
                                          className="input text-xs flex-1" placeholder="0" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Data labels per layer */}
                                  <div className="pt-1 border-t border-surface-200 dark:border-dark-surface-100">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">{t('designer.data_labels')}</p>
                                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer mb-1.5">
                                      <input type="checkbox" checked={labelShow}
                                        onChange={e => patchSeriesConfig(layer, { label: { ...(sc.label as object || {}), show: e.target.checked } })}
                                        className="rounded border-slate-300" />
                                      {t('designer.show_data_labels')}
                                    </label>
                                    {labelShow && (
                                      <div className="space-y-1.5">
                                        <select value={labelPos}
                                          onChange={e => patchSeriesConfig(layer, { label: { ...(sc.label as object || {}), show: true, position: e.target.value } })}
                                          className="input text-xs w-full">
                                          <option value="top">{t('designer.data_label_position.top')}</option>
                                          <option value="inline">{t('designer.data_label_position.inline')}</option>
                                        </select>
                                        <select
                                          value={(sc.dataLabelMode as string) || 'all'}
                                          onChange={e => patchSeriesConfig(layer, { dataLabelMode: e.target.value })}
                                          className="input text-xs w-full">
                                          <option value="all">{t('designer.label_mode.all')}</option>
                                          <option value="first">{t('designer.label_mode.first_n')}</option>
                                          <option value="last">{t('designer.label_mode.last_n')}</option>
                                          <option value="min_max">{t('designer.label_mode.min_max')}</option>
                                        </select>
                                        {((sc.dataLabelMode as string) === 'first' || (sc.dataLabelMode as string) === 'last') && (
                                          <NumericInput
                                            value={(sc.dataLabelCount as number) || 3}
                                            onChange={v => patchSeriesConfig(layer, { dataLabelCount: v ?? 3 })}
                                            className="input text-xs w-full"
                                            placeholder={t('designer.label_count_placeholder')}
                                          />
                                        )}
                                        <div className="flex items-center gap-2">
                                          <NumericInput
                                            value={(sc.dataLabelDecimals as number) ?? 0}
                                            onChange={v => patchSeriesConfig(layer, { dataLabelDecimals: v ?? 0 })}
                                            className="input text-xs w-20"
                                          />
                                          <span className="text-[10px] text-slate-400">{t('designer.y_axis_decimals')}</span>
                                          <NumericInput
                                            value={(sc.dataLabelFontSize as number) ?? 10}
                                            onChange={v => patchSeriesConfig(layer, { dataLabelFontSize: v ?? 10 })}
                                            className="input text-xs w-16"
                                          />
                                          <span className="text-[10px] text-slate-400">px</span>
                                        </div>
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                          <input type="checkbox"
                                            checked={(sc.dataLabelBoxed as boolean) || false}
                                            onChange={e => patchSeriesConfig(layer, { dataLabelBoxed: e.target.checked })}
                                            className="rounded border-slate-300" />
                                          {t('designer.data_label_boxed')}
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                          <input type="checkbox"
                                            checked={(sc.dataLabelThousandsSep as boolean | undefined) !== false}
                                            onChange={e => patchSeriesConfig(layer, { dataLabelThousandsSep: e.target.checked })}
                                            className="rounded border-slate-300" />
                                          {t('designer.data_label_thousands_sep')}
                                        </label>
                                        {labelPos !== 'inline' && (
                                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                            <input type="checkbox"
                                              checked={(sc.dataLabelSpread as boolean) || false}
                                              onChange={e => patchSeriesConfig(layer, { dataLabelSpread: e.target.checked })}
                                              className="rounded border-slate-300" />
                                            {t('designer.data_label_spread')}
                                          </label>
                                        )}
                                        {labelPos !== 'inline' && (
                                          <select
                                            value={(sc.dataLabelTopSpacingMode as string) || 'dynamic'}
                                            onChange={e => patchSeriesConfig(layer, { dataLabelTopSpacingMode: e.target.value })}
                                            className="input text-xs w-full">
                                            <option value="dynamic">{t('designer.label_top_spacing_mode.dynamic')}</option>
                                            <option value="fixed">{t('designer.label_top_spacing_mode.fixed')}</option>
                                          </select>
                                        )}
                                        <select
                                          value={String((sc.dataLabelRotation as number) || 0)}
                                          onChange={e => patchSeriesConfig(layer, { dataLabelRotation: Number(e.target.value) })}
                                          className="input text-xs w-full">
                                          <option value="0">{t('designer.label_rotation.horizontal')}</option>
                                          <option value="-45">{t('designer.label_rotation.angled_up')}</option>
                                          <option value="45">{t('designer.label_rotation.angled_down')}</option>
                                          <option value="-90">{t('designer.label_rotation.vertical')}</option>
                                        </select>
                                      </div>
                                    )}
                                  </div>

                                  {/* Min/Max markers + linear regression (per layer) */}
                                  <div className="pt-1 border-t border-surface-200 dark:border-dark-surface-100 space-y-1.5">
                                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                      <input type="checkbox"
                                        checked={!!sc.markMinMax}
                                        onChange={e => patchSeriesConfig(layer, { markMinMax: e.target.checked ? true : undefined })}
                                        className="rounded border-slate-300" />
                                      {t('designer.chart_mark_minmax')}
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                      <input type="checkbox"
                                        checked={Array.isArray(cc.regressionFields) && (cc.regressionFields as string[]).includes(layer.label || layer.name)}
                                        onChange={e => {
                                          const seriesName = layer.label || layer.name
                                          const current = Array.isArray(cc.regressionFields) ? [...(cc.regressionFields as string[])] : []
                                          const next = e.target.checked
                                            ? [...current.filter(n => n !== seriesName), seriesName]
                                            : current.filter(n => n !== seriesName)
                                          update({ chartConfig: { ...cc, regressionFields: next.length ? next : undefined } })
                                        }}
                                        className="rounded border-slate-300" />
                                      {t('designer.regression_lines')}
                                    </label>
                                  </div>

                                  {/* Threshold lines (per layer) - bound to this layer's axis */}
                                  {(() => {
                                    type ThrLine = { value: number; color?: string; label?: string; style?: string }
                                    const thr = Array.isArray(sc.thresholdLines) ? (sc.thresholdLines as ThrLine[]) : []
                                    const setThr = (next: ThrLine[]) => patchSeriesConfig(layer, { thresholdLines: next.length ? next : undefined })
                                    const updThr = (i: number, patch: Partial<ThrLine>) => { const n = [...thr]; n[i] = { ...n[i], ...patch }; setThr(n) }
                                    return (
                                      <div className="pt-1 border-t border-surface-200 dark:border-dark-surface-100">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">{t('designer.chart_threshold_lines')}</p>
                                        <div className="space-y-1">
                                          {thr.map((ln, i) => (
                                            <div key={i} className="space-y-1 border border-surface-200 dark:border-dark-surface-100 rounded p-1.5">
                                              <div className="flex items-center gap-1.5">
                                                <NumericInput value={ln.value} onChange={v => updThr(i, { value: v ?? 0 })}
                                                  className="w-20 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                                                  placeholder={t('designer.chart_threshold_value')} />
                                                <input type="color" value={ln.color || '#94a3b8'}
                                                  onChange={e => updThr(i, { color: e.target.value })}
                                                  className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent" />
                                                <select value={ln.style || 'dashed'} onChange={e => updThr(i, { style: e.target.value })}
                                                  className="input text-xs flex-1 py-0.5">
                                                  <option value="solid">{t('designer.chart_threshold_style.solid')}</option>
                                                  <option value="dashed">{t('designer.chart_threshold_style.dashed')}</option>
                                                  <option value="dotted">{t('designer.chart_threshold_style.dotted')}</option>
                                                </select>
                                                <button onClick={() => setThr(thr.filter((_, j) => j !== i))}
                                                  className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3 h-3" /></button>
                                              </div>
                                              <input type="text" value={ln.label || ''}
                                                onChange={e => updThr(i, { label: e.target.value || undefined })}
                                                placeholder={t('designer.chart_threshold_label')}
                                                className="w-full text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50" />
                                            </div>
                                          ))}
                                          <button onClick={() => setThr([...thr, { value: 0, color: '#94a3b8', style: 'dashed' }])}
                                            className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5">
                                            <Plus className="w-3 h-3" /> {t('designer.chart_add_threshold')}
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })()}

                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {!hasLayers && <Field label={t('designer.data_labels')}>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!cc.showDataLabels}
                        onChange={e => update({ chartConfig: { ...cc, showDataLabels: e.target.checked } })}
                        className="rounded border-slate-300"
                      />
                      {t('designer.show_data_labels')}
                    </label>
                    {!!cc.showDataLabels && (
                      <div className="mt-2 space-y-2">
                        <select
                          value={cc.dataLabelPosition as string || 'top'}
                          onChange={e => update({ chartConfig: { ...cc, dataLabelPosition: e.target.value } })}
                          className="input text-sm"
                        >
                          <option value="top">{t('designer.data_label_position.top')}</option>
                          <option value="inline">{t('designer.data_label_position.inline')}</option>
                        </select>
                        <select
                          value={cc.dataLabelMode as string || 'all'}
                          onChange={e => update({ chartConfig: { ...cc, dataLabelMode: e.target.value } })}
                          className="input text-sm"
                        >
                          <option value="all">{t('designer.label_mode.all')}</option>
                          <option value="first">{t('designer.label_mode.first_n')}</option>
                          <option value="last">{t('designer.label_mode.last_n')}</option>
                          <option value="min_max">{t('designer.label_mode.min_max')}</option>
                        </select>
                        {(cc.dataLabelMode === 'first' || cc.dataLabelMode === 'last') && (
                          <NumericInput
                            value={cc.dataLabelCount as number || 3}
                            onChange={v => update({ chartConfig: { ...cc, dataLabelCount: v ?? 3 } })}
                            className="input text-sm"
                            placeholder={t('designer.label_count_placeholder')}
                          />
                        )}
                        <select
                          value={cc.dataLabelTopSpacingMode as string || 'dynamic'}
                          onChange={e => update({ chartConfig: { ...cc, dataLabelTopSpacingMode: e.target.value } })}
                          className="input text-sm"
                        >
                          <option value="dynamic">{t('designer.label_top_spacing_mode.dynamic')}</option>
                          <option value="fixed">{t('designer.label_top_spacing_mode.fixed')}</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <NumericInput
                            value={cc.dataLabelDecimals != null ? Number(cc.dataLabelDecimals) : 1}
                            onChange={v => update({ chartConfig: { ...cc, dataLabelDecimals: v ?? 1 } })}
                            className="input text-sm w-16"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{t('designer.data_label_decimals')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <NumericInput
                            value={cc.dataLabelFontSize != null ? Number(cc.dataLabelFontSize) : 10}
                            onChange={v => update({ chartConfig: { ...cc, dataLabelFontSize: v ?? undefined } })}
                            className="input text-sm w-16"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{t('designer.data_label_font_size')}</span>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cc.dataLabelThousandsSep !== false}
                            onChange={e => update({ chartConfig: { ...cc, dataLabelThousandsSep: e.target.checked } })}
                            className="rounded border-slate-300"
                          />
                          {t('designer.data_label_thousands_sep')}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!cc.dataLabelBoxed}
                            onChange={e => update({ chartConfig: { ...cc, dataLabelBoxed: e.target.checked } })}
                            className="rounded border-slate-300"
                          />
                          {t('designer.data_label_boxed')}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!cc.dataLabelSpread}
                            onChange={e => update({ chartConfig: { ...cc, dataLabelSpread: e.target.checked } })}
                            className="rounded border-slate-300"
                          />
                          {t('designer.data_label_spread')}
                        </label>
                        <select
                          value={String(cc.dataLabelRotation || 0)}
                          onChange={e => update({ chartConfig: { ...cc, dataLabelRotation: Number(e.target.value) } })}
                          className="input text-sm"
                        >
                          <option value="0">{t('designer.label_rotation.horizontal')}</option>
                          <option value="-45">{t('designer.label_rotation.angled_up')}</option>
                          <option value="45">{t('designer.label_rotation.angled_down')}</option>
                          <option value="-90">{t('designer.label_rotation.vertical')}</option>
                        </select>
                      </div>
                    )}
                  </Field>}

                  {AXIS_CHART_TYPES.includes((cc.type as string) || 'bar') && (
                    <Field label={t('designer.chart_threshold_lines')}>
                      {(() => {
                        type ThresholdLine = { value: number; color?: string; label?: string; style?: string }
                        const lines = (cc.thresholdLines as ThresholdLine[]) || []
                        const setLines = (next: ThresholdLine[]) =>
                          update({ chartConfig: { ...cc, thresholdLines: next.length ? next : undefined } })
                        const updateLine = (idx: number, patch: Partial<ThresholdLine>) => {
                          const next = [...lines]
                          next[idx] = { ...next[idx], ...patch }
                          setLines(next)
                        }
                        return (
                          <div className="space-y-1">
                            {lines.map((ln, idx) => (
                              <div key={idx} className="space-y-1 border border-surface-200 dark:border-dark-surface-100 rounded p-1.5">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <NumericInput
                                    value={ln.value}
                                    onChange={v => updateLine(idx, { value: v ?? 0 })}
                                    className="w-20 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                                    placeholder={t('designer.chart_threshold_value')}
                                  />
                                  <input
                                    type="color"
                                    value={ln.color || '#94a3b8'}
                                    onChange={e => updateLine(idx, { color: e.target.value })}
                                    className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                                  />
                                  <input
                                    type="text"
                                    value={ln.color || ''}
                                    onChange={e => {
                                      const v = e.target.value.trim()
                                      if (v === '') updateLine(idx, { color: undefined })
                                      else if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) updateLine(idx, { color: v.toLowerCase() })
                                    }}
                                    placeholder="#hex"
                                    maxLength={7}
                                    className="w-16 font-mono text-[10px] px-1 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                                  />
                                  <select
                                    value={ln.style || 'dashed'}
                                    onChange={e => updateLine(idx, { style: e.target.value })}
                                    className="input text-xs flex-1 py-0.5"
                                  >
                                    <option value="solid">{t('designer.chart_threshold_style.solid')}</option>
                                    <option value="dashed">{t('designer.chart_threshold_style.dashed')}</option>
                                    <option value="dotted">{t('designer.chart_threshold_style.dotted')}</option>
                                  </select>
                                  <button
                                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                                    className="text-red-500 hover:text-red-700 p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={ln.label || ''}
                                  onChange={e => updateLine(idx, { label: e.target.value || undefined })}
                                  placeholder={t('designer.chart_threshold_label')}
                                  className="w-full text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                                />
                              </div>
                            ))}
                            <button
                              onClick={() => setLines([...lines, { value: 0, color: '#94a3b8', style: 'dashed' }])}
                              className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5"
                            >
                              <Plus className="w-3 h-3" /> {t('designer.chart_add_threshold')}
                            </button>
                          </div>
                        )
                      })()}
                    </Field>
                  )}

                  {(['line', 'bar'].includes((cc.type as string) || 'bar')) && (() => {
                    const mm = cc.markMinMax as boolean | { min?: boolean; max?: boolean } | undefined
                    const enabled = !!mm
                    const flags = typeof mm === 'object' && mm !== null ? mm : (mm ? { min: true, max: true } : { min: false, max: false })
                    return (
                      <Field label={t('designer.chart_mark_minmax')}>
                        <label className="inline-flex items-center gap-1.5 text-xs mb-1">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => update({ chartConfig: { ...cc, markMinMax: e.target.checked ? { min: true, max: true } : undefined } })}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_mark_minmax_enable')}</span>
                        </label>
                        {enabled && (
                          <div className="flex items-center gap-3 pl-1 text-xs border-l-2 border-surface-200 dark:border-dark-surface-100">
                            <label className="inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={flags.max !== false}
                                onChange={e => update({ chartConfig: { ...cc, markMinMax: { ...flags, max: e.target.checked } } })}
                                className="h-3.5 w-3.5"
                              />
                              <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_mark_max')}</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={flags.min !== false}
                                onChange={e => update({ chartConfig: { ...cc, markMinMax: { ...flags, min: e.target.checked } } })}
                                className="h-3.5 w-3.5"
                              />
                              <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_mark_min')}</span>
                            </label>
                          </div>
                        )}
                      </Field>
                    )
                  })()}

                  {((cc.type as string) || 'bar') === 'bar' && availableCols.length > 0 && (() => {
                    type BarCondConfig = { series?: string; field?: string; threshold: number; colorAbove: string; colorBelow: string }
                    const bc = cc.barConditionalColor as BarCondConfig | undefined
                    const enabled = !!bc
                    return (
                      <Field label={t('designer.chart_bar_conditional')}>
                        <label className="inline-flex items-center gap-1.5 text-xs mb-1">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => update({ chartConfig: {
                              ...cc,
                              barConditionalColor: e.target.checked
                                ? { threshold: 0, colorAbove: '#22c55e', colorBelow: '#ef4444' }
                                : undefined,
                            } })}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_bar_conditional_enable')}</span>
                        </label>
                        {enabled && bc && (
                          <div className="space-y-1.5 pl-1 border-l-2 border-surface-200 dark:border-dark-surface-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-24">{t('designer.chart_bar_threshold')}:</span>
                              <NumericInput
                                value={bc.threshold}
                                onChange={v => update({ chartConfig: { ...cc, barConditionalColor: { ...bc, threshold: v ?? 0 } } })}
                                className="w-24 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-24">{t('designer.chart_bar_above')}:</span>
                              <input
                                type="color"
                                value={bc.colorAbove}
                                onChange={e => update({ chartConfig: { ...cc, barConditionalColor: { ...bc, colorAbove: e.target.value } } })}
                                className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={bc.colorAbove}
                                onChange={e => update({ chartConfig: { ...cc, barConditionalColor: { ...bc, colorAbove: e.target.value } } })}
                                className="flex-1 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50 font-mono"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-24">{t('designer.chart_bar_below')}:</span>
                              <input
                                type="color"
                                value={bc.colorBelow}
                                onChange={e => update({ chartConfig: { ...cc, barConditionalColor: { ...bc, colorBelow: e.target.value } } })}
                                className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={bc.colorBelow}
                                onChange={e => update({ chartConfig: { ...cc, barConditionalColor: { ...bc, colorBelow: e.target.value } } })}
                                className="flex-1 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50 font-mono"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-24">{t('designer.chart_bar_field')}:</span>
                              <select
                                value={bc.field || ''}
                                onChange={e => update({ chartConfig: { ...cc, barConditionalColor: { ...bc, field: e.target.value || undefined } } })}
                                className="input text-xs flex-1 py-0.5"
                              >
                                <option value="">{t('designer.chart_bar_field_self')}</option>
                                {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </Field>
                    )
                  })()}

                  {((cc.type as string) || 'bar') === 'line' && availableCols.length > 0 && (() => {
                    type DeltaAnnConfig = { valueField?: string; position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' }
                    const da = cc.deltaAnnotation as DeltaAnnConfig | undefined
                    const enabled = !!da
                    return (
                      <Field label={t('designer.chart_delta_annotation')}>
                        <label className="inline-flex items-center gap-1.5 text-xs mb-1">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => update({ chartConfig: { ...cc, deltaAnnotation: e.target.checked ? {} : undefined } })}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_delta_annotation_enable')}</span>
                        </label>
                        {enabled && da && (
                          <div className="space-y-1.5 pl-1 border-l-2 border-surface-200 dark:border-dark-surface-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.chart_delta_field')}:</span>
                              <select
                                value={da.valueField || ''}
                                onChange={e => update({ chartConfig: { ...cc, deltaAnnotation: { ...da, valueField: e.target.value || undefined } } })}
                                className="input text-xs flex-1 py-0.5"
                              >
                                <option value="">{t('designer.chart_delta_field_first')}</option>
                                {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.chart_delta_position')}:</span>
                              <select
                                value={da.position || 'top-right'}
                                onChange={e => update({ chartConfig: { ...cc, deltaAnnotation: { ...da, position: e.target.value as DeltaAnnConfig['position'] } } })}
                                className="input text-xs flex-1 py-0.5"
                              >
                                <option value="top-right">{t('designer.chart_delta_pos.top_right')}</option>
                                <option value="top-left">{t('designer.chart_delta_pos.top_left')}</option>
                                <option value="bottom-right">{t('designer.chart_delta_pos.bottom_right')}</option>
                                <option value="bottom-left">{t('designer.chart_delta_pos.bottom_left')}</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </Field>
                    )
                  })()}

                  {((cc.type as string) || 'bar') === 'pie' && (() => {
                    const colorBy = (cc.categoryField as string) || availableCols[0]
                    const colorsMap = (cc.colors as Record<string, string> | undefined) || {}
                    const sampleDistinct = Array.from(new Set(
                      (previewRows || [])
                        .map(r => r[colorBy])
                        .filter(v => v != null && String(v).trim() !== '')
                        .map(v => String(v))
                    ))
                    const allValues = Array.from(new Set([...sampleDistinct, ...Object.keys(colorsMap)])).sort()
                    const setSegColor = (val: string, hex: string) => {
                      update({ chartConfig: { ...cc, colors: { ...colorsMap, [val]: hex } } })
                    }
                    const clearSegColor = (val: string) => {
                      const next = { ...colorsMap }
                      delete next[val]
                      const hasAny = Object.keys(next).length > 0
                      update({ chartConfig: { ...cc, colors: hasAny ? next : undefined } })
                    }
                    type CenterLabelCfg = { text?: string; valueField?: string; fontSize?: number; subtext?: string; color?: string }
                    const cl = (cc.centerLabel as CenterLabelCfg | undefined)
                    return (
                      <>
                        <Field label={t('designer.chart_pie_donut')}>
                          <label className="inline-flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={!!cc.donut}
                              onChange={e => update({ chartConfig: { ...cc, donut: e.target.checked || undefined } })}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_pie_donut_hint')}</span>
                          </label>
                        </Field>

                        <Field label={t('designer.chart_pie_label_content')}>
                          <select
                            value={(cc.pieLabelContent as string) || (cc.showPercentages ? 'name-percent' : 'name')}
                            onChange={e => {
                              const v = e.target.value
                              update({ chartConfig: { ...cc, pieLabelContent: v === 'name' ? undefined : v, showPercentages: undefined } })
                            }}
                            className="input text-sm"
                          >
                            <option value="name">{t('designer.chart_pie_label_content_name')}</option>
                            <option value="value">{t('designer.chart_pie_label_content_value')}</option>
                            <option value="percent">{t('designer.chart_pie_label_content_percent')}</option>
                            <option value="name-value">{t('designer.chart_pie_label_content_name_value')}</option>
                            <option value="name-percent">{t('designer.chart_pie_label_content_name_percent')}</option>
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1">{t('designer.chart_pie_label_content_hint')}</p>
                        </Field>

                        <Field label={t('designer.chart_pie_segment_colors')}>
                          <p className="text-[10px] text-slate-400 mb-1">{t('designer.chart_pie_segment_colors_hint')}</p>
                          {allValues.length === 0 ? (
                            <p className="text-[10px] text-slate-400 px-1">{t('designer.row_color_preview_needed')}</p>
                          ) : (
                            <div className="space-y-1 border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
                              {allValues.map(val => {
                                const hex = colorsMap[val] || ''
                                return (
                                  <div key={val} className="flex items-center gap-2 text-xs">
                                    <span className="flex-1 truncate text-slate-600 dark:text-slate-300" title={val}>{val}</span>
                                    <input
                                      type="color"
                                      value={hex || '#cccccc'}
                                      onChange={e => setSegColor(val, e.target.value)}
                                      className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                                    />
                                    <input
                                      type="text"
                                      value={hex}
                                      onChange={e => {
                                        const v = e.target.value.trim()
                                        if (v === '') { clearSegColor(val); return }
                                        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) setSegColor(val, v.toLowerCase())
                                      }}
                                      placeholder="#rrggbb"
                                      maxLength={7}
                                      className="w-16 font-mono text-[10px] px-1 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                                    />
                                    {hex && (
                                      <button
                                        onClick={() => clearSegColor(val)}
                                        title={t('common.clear')}
                                        className="text-slate-400 hover:text-red-500"
                                      >×</button>
                                    )}
                                  </div>
                                )
                              })}
                              <AddColorValueRow
                                existingValues={allValues}
                                defaultColor="#cccccc"
                                onAdd={(val, hex) => setSegColor(val, hex)}
                                placeholder={t('designer.row_color_add_value')}
                              />
                            </div>
                          )}
                        </Field>

                        {!!cc.donut && (
                          <Field label={t('designer.chart_pie_center_label')}>
                            <div className="space-y-1.5 text-xs">
                              <input
                                type="text"
                                value={cl?.text || ''}
                                onChange={e => update({ chartConfig: { ...cc, centerLabel: { ...(cl || {}), text: e.target.value || undefined } } })}
                                placeholder={t('designer.chart_pie_center_text')}
                                className="input text-xs"
                              />
                              <select
                                value={cl?.valueField || ''}
                                onChange={e => update({ chartConfig: { ...cc, centerLabel: { ...(cl || {}), valueField: e.target.value || undefined } } })}
                                className="input text-xs"
                              >
                                <option value="">{t('designer.chart_pie_center_static')}</option>
                                {availableCols.map(c => <option key={c} value={c}>{t('designer.chart_pie_center_sum_of', { col: c })}</option>)}
                              </select>
                              <input
                                type="text"
                                value={cl?.subtext || ''}
                                onChange={e => update({ chartConfig: { ...cc, centerLabel: { ...(cl || {}), subtext: e.target.value || undefined } } })}
                                placeholder={t('designer.chart_pie_center_subtext')}
                                className="input text-xs"
                              />
                              <p className="text-[10px] text-slate-400">{t('designer.chart_pie_center_hint')}</p>
                            </div>
                          </Field>
                        )}
                      </>
                    )
                  })()}

                  {((cc.type as string) || 'bar') === 'line' && (() => {
                    type HighlightConfig = { size?: number; colorMode?: 'step' | 'gradient'; colorStops?: Array<{ at: number; color: string }> }
                    const hl = cc.highlightLastPoint as HighlightConfig | undefined
                    const enabled = !!hl
                    return (
                      <Field label={t('designer.chart_highlight_last_point')}>
                        <label className="inline-flex items-center gap-1.5 text-xs mb-1">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => update({ chartConfig: { ...cc, highlightLastPoint: e.target.checked ? {} : undefined } })}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_highlight_last_enable')}</span>
                        </label>
                        {enabled && hl && (
                          <div className="space-y-1.5 pl-1 border-l-2 border-surface-200 dark:border-dark-surface-100">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.chart_highlight_size')}:</span>
                              <NumericInput
                                value={hl.size || 12}
                                onChange={v => update({ chartConfig: { ...cc, highlightLastPoint: { ...hl, size: v ?? 12 } } })}
                                className="w-16 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                              />
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.kpi_color_mode')}:</span>
                              <select
                                value={hl.colorMode || 'step'}
                                onChange={e => update({ chartConfig: { ...cc, highlightLastPoint: { ...hl, colorMode: e.target.value as 'step' | 'gradient' } } })}
                                className="input text-xs flex-1 py-0.5"
                              >
                                <option value="step">{t('designer.kpi_color_mode.step')}</option>
                                <option value="gradient">{t('designer.kpi_color_mode.gradient')}</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">{t('designer.kpi_color_stops')}:</span>
                              <ColorStopsEditor
                                stops={hl.colorStops || []}
                                onChange={stops => update({
                                  chartConfig: {
                                    ...cc,
                                    highlightLastPoint: { ...hl, colorStops: stops.length ? stops : undefined },
                                  },
                                })}
                                addLabel={t('designer.kpi_add_stop')}
                              />
                            </div>
                          </div>
                        )}
                      </Field>
                    )
                  })()}
                </>
              )
            })()}

            {/* ── TABLE Config ── */}
            {widget.widgetType === 'TABLE' && availableCols.length > 0 && (() => {
              const visibleCols = cc.visibleColumns as string[] | undefined
              const isAllVisible = !Array.isArray(visibleCols)
              const effectiveCols = isAllVisible ? availableCols : visibleCols

              const handleToggleCol = (col: string) => {
                const current = isAllVisible ? [...availableCols] : [...visibleCols]
                const next = current.includes(col)
                  ? current.filter(c => c !== col)
                  : [...current, col]
                if (next.length === availableCols.length) {
                  const { visibleColumns: _, ...rest } = cc
                  update({ chartConfig: rest })
                } else {
                  update({ chartConfig: { ...cc, visibleColumns: next } })
                }
              }

              const moveCol = (col: string, dir: -1 | 1) => {
                const cols = isAllVisible ? [...availableCols] : [...visibleCols]
                const idx = cols.indexOf(col)
                if (idx < 0) return
                const newIdx = idx + dir
                if (newIdx < 0 || newIdx >= cols.length) return
                ;[cols[idx], cols[newIdx]] = [cols[newIdx], cols[idx]]
                update({ chartConfig: { ...cc, visibleColumns: cols } })
              }

              return (
                <>
                  <Field label={t('designer.visible_columns')}>
                    <div className="flex items-center gap-1 mb-1">
                      <button
                        onClick={() => { const { visibleColumns: _, ...rest } = cc; update({ chartConfig: rest }) }}
                        className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5"
                      >
                        <CheckSquare className="w-3 h-3" /> {t('designer.select_all')}
                      </button>
                      <button
                        onClick={() => update({ chartConfig: { ...cc, visibleColumns: [] } })}
                        className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5"
                      >
                        <Square className="w-3 h-3" /> {t('designer.deselect_all')}
                      </button>
                    </div>
                    <div className="space-y-0.5 max-h-60 overflow-y-auto border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
                      {(isAllVisible ? availableCols : [...visibleCols, ...availableCols.filter(c => !visibleCols.includes(c))]).map(col => {
                        const perCol = (cc.totalsPerColumn as Record<string, string>) || {}
                        const isVisible = isAllVisible || effectiveCols.includes(col)
                        return (
                          <div key={col} className="flex items-center gap-1 group">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => handleToggleCol(col)}
                              className="rounded border-slate-300 flex-shrink-0"
                            />
                            <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate" title={col}>{col}</span>
                            {!!cc.showTotals && (
                              <select
                                value={perCol[col] || ''}
                                onChange={e => {
                                  const next = { ...perCol }
                                  if (e.target.value) next[col] = e.target.value
                                  else delete next[col]
                                  update({ chartConfig: { ...cc, totalsPerColumn: next } })
                                }}
                                className="text-[10px] border border-surface-200 dark:border-dark-surface-100 rounded px-0.5 py-0 bg-white dark:bg-dark-surface-200 text-slate-500 dark:text-slate-400 w-16 flex-shrink-0"
                                title={t('designer.show_totals')}
                              >
                                <option value="">SUM</option>
                                <option value="SUM">SUM</option>
                                <option value="COUNT">CNT</option>
                                <option value="DISTINCT_COUNT">DST</option>
                                <option value="AVG">AVG</option>
                                <option value="MIN">MIN</option>
                                <option value="MAX">MAX</option>
                                <option value="NONE">--</option>
                              </select>
                            )}
                            {!isAllVisible && isVisible && (
                              <span className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0">
                                <button onClick={() => moveCol(col, -1)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                                  <ArrowUp className="w-3 h-3 text-slate-400" />
                                </button>
                                <button onClick={() => moveCol(col, 1)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                                  <ArrowDown className="w-3 h-3 text-slate-400" />
                                </button>
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{t('designer.table_columns_hint')}</p>
                  </Field>

                  <Field label={t('designer.table_density')}>
                    <select
                      value={cc.tableDensity as string || 'default'}
                      onChange={e => update({ chartConfig: { ...cc, tableDensity: e.target.value } })}
                      className="input text-sm"
                    >
                      <option value="compact">{t('designer.table_density.compact')}</option>
                      <option value="default">{t('designer.table_density.default')}</option>
                      <option value="large">{t('designer.table_density.large')}</option>
                    </select>
                  </Field>

                  <Field label={t('designer.table_page_size')}>
                    <NumericInput
                      value={cc.tablePageSize as number | undefined}
                      onChange={v => update({ chartConfig: { ...cc, tablePageSize: v } })}
                      className="input text-sm"
                      placeholder={t('designer.table_page_size_auto')}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{t('designer.table_page_size_hint')}</p>
                  </Field>

                  <Field label={t('designer.show_totals')}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!cc.showTotals}
                        onChange={e => update({ chartConfig: { ...cc, showTotals: e.target.checked, totalsAggregation: e.target.checked ? (cc.totalsAggregation || 'SUM') : undefined } })}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">{t('designer.show_totals_hint')}</span>
                    </label>
                  </Field>

                  {/* Conditional row coloring: pick a column, map its values to colours */}
                  {availableCols.length > 0 && (
                    <Field label={t('designer.row_color_by')}>
                      <select
                        value={(cc.rowColorBy as string) || ''}
                        onChange={e => {
                          const val = e.target.value || undefined
                          const next: Record<string, unknown> = { ...cc }
                          if (val) next.rowColorBy = val
                          else { delete next.rowColorBy; delete next.rowColors }
                          update({ chartConfig: next })
                        }}
                        className="input text-sm"
                      >
                        <option value="">{t('common.none')}</option>
                        {availableCols.map((c: string) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">{t('designer.row_color_by_hint')}</p>

                      {!!cc.rowColorBy && (() => {
                        const colorBy = cc.rowColorBy as string
                        const currentColors = (cc.rowColors as Record<string, string> | undefined) || {}
                        // Values list: union of (sample distinct) + (already configured).
                        // The preview sample may not cover all values (e.g. sort by
                        // priority_rank means first 100 rows are all 'Высокий').
                        // Users can type additional values in the input below.
                        const sampleDistinct = Array.from(new Set(
                          (previewRows || [])
                            .map(r => r[colorBy])
                            .filter(v => v != null && String(v).trim() !== '')
                            .map(v => String(v))
                        ))
                        const allValues: string[] = Array.from(
                          new Set([...sampleDistinct, ...Object.keys(currentColors)])
                        ).sort()
                        const setValueColor = (val: string, hex: string) => {
                          const nextColors = { ...currentColors, [val]: hex }
                          update({ chartConfig: { ...cc, rowColors: nextColors } })
                        }
                        const clearValueColor = (val: string) => {
                          const nextColors = { ...currentColors }
                          delete nextColors[val]
                          update({ chartConfig: { ...cc, rowColors: nextColors } })
                        }
                        return (
                          <div className="mt-2 space-y-1 border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
                            {/* Apply colour to whole row or just the reference cell */}
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 pb-1 border-b border-surface-100 dark:border-dark-surface-100">
                              <span>{t('designer.row_color_apply_to')}:</span>
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`rcm_${widget.id}`}
                                  checked={(cc.rowColorMode as string) !== 'cell'}
                                  onChange={() => update({ chartConfig: { ...cc, rowColorMode: 'row' } })}
                                />
                                {t('designer.row_color_mode_row')}
                              </label>
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`rcm_${widget.id}`}
                                  checked={cc.rowColorMode === 'cell'}
                                  onChange={() => update({ chartConfig: { ...cc, rowColorMode: 'cell' } })}
                                />
                                {t('designer.row_color_mode_cell')}
                              </label>
                            </div>
                            {allValues.length === 0 && (
                              <p className="text-[10px] text-slate-400 px-1">
                                {t('designer.row_color_preview_needed')}
                              </p>
                            )}
                            {allValues.map(val => {
                              const hex = currentColors[val] || ''
                              return (
                                <div key={val} className="flex items-center gap-2 text-xs">
                                  <span className="flex-1 truncate text-slate-600 dark:text-slate-300" title={val}>{val}</span>
                                  <input
                                    type="color"
                                    value={hex || '#ffffff'}
                                    onChange={e => setValueColor(val, e.target.value)}
                                    className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                                  />
                                  <input
                                    type="text"
                                    value={hex}
                                    onChange={e => {
                                      const v = e.target.value.trim()
                                      // Accept "#rgb", "#rrggbb", or empty to clear
                                      if (v === '') { clearValueColor(val); return }
                                      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                                        setValueColor(val, v.toLowerCase())
                                      }
                                    }}
                                    placeholder="#rrggbb"
                                    maxLength={7}
                                    className="w-16 font-mono text-[10px] px-1 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                                  />
                                  {hex && (
                                    <button
                                      onClick={() => clearValueColor(val)}
                                      title={t('common.clear')}
                                      className="text-slate-400 hover:text-red-500"
                                    >×</button>
                                  )}
                                </div>
                              )
                            })}
                            {/* Add value manually - useful when preview sample doesn't
                                surface all possible values (sorted/filtered queries). */}
                            <AddColorValueRow
                              existingValues={allValues}
                              defaultColor="#fef3c7"
                              onAdd={(val, hex) => setValueColor(val, hex)}
                              placeholder={t('designer.row_color_add_value')}
                            />
                          </div>
                        )
                      })()}
                    </Field>
                  )}

                  <Field label={t('designer.table_column_formatters')}>
                    {(() => {
                      type ColorStop = { at: number; color: string }
                      type DeltaFmt = { type: 'delta'; showArrow?: boolean; colorMode?: 'sign' | 'none' }
                      type HeatmapFmt = { type: 'heatmap'; colorMode?: 'step' | 'gradient'; colorStops: ColorStop[]; background?: boolean }
                      type BarFmt = { type: 'bar'; max?: number | 'auto'; color?: string }
                      type ColumnFormatter = DeltaFmt | HeatmapFmt | BarFmt

                      const formatters = (cc.columnFormatters as Record<string, ColumnFormatter>) || {}
                      const setFormatter = (col: string, fmt: ColumnFormatter | undefined) => {
                        const next = { ...formatters }
                        if (fmt === undefined) delete next[col]
                        else next[col] = fmt
                        const hasAny = Object.keys(next).length > 0
                        update({ chartConfig: { ...cc, columnFormatters: hasAny ? next : undefined } })
                      }
                      const remainingCols = availableCols.filter(c => !(c in formatters))
                      const defaultHeatmap: HeatmapFmt = {
                        type: 'heatmap',
                        colorMode: 'gradient',
                        colorStops: [{ at: 0, color: '#ef4444' }, { at: 1, color: '#22c55e' }],
                      }

                      return (
                        <div className="space-y-2">
                          {Object.entries(formatters).map(([col, fmt]) => (
                            <div key={col} className="border border-surface-200 dark:border-dark-surface-100 rounded p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex-1 truncate" title={col}>{col}</span>
                                <select
                                  value={fmt.type}
                                  onChange={e => {
                                    const nextType = e.target.value as 'heatmap' | 'bar' | 'delta'
                                    if (nextType === 'heatmap') setFormatter(col, defaultHeatmap)
                                    else if (nextType === 'bar') setFormatter(col, { type: 'bar', max: 'auto', color: '#3b82f6' })
                                    else setFormatter(col, { type: 'delta', colorMode: 'sign', showArrow: true })
                                  }}
                                  className="input text-xs py-0.5 w-24"
                                >
                                  <option value="heatmap">{t('designer.table_formatter.heatmap')}</option>
                                  <option value="bar">{t('designer.table_formatter.bar')}</option>
                                  <option value="delta">{t('designer.table_formatter.delta')}</option>
                                </select>
                                <button
                                  onClick={() => setFormatter(col, undefined)}
                                  className="text-red-500 hover:text-red-700 p-0.5"
                                  title={t('common.delete')}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              {fmt.type === 'heatmap' && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.kpi_color_mode')}:</span>
                                    <select
                                      value={fmt.colorMode || 'gradient'}
                                      onChange={e => setFormatter(col, { ...fmt, colorMode: e.target.value as 'step' | 'gradient' })}
                                      className="input text-xs flex-1 py-0.5"
                                    >
                                      <option value="step">{t('designer.kpi_color_mode.step')}</option>
                                      <option value="gradient">{t('designer.kpi_color_mode.gradient')}</option>
                                    </select>
                                  </div>
                                  <ColorStopsEditor
                                    stops={fmt.colorStops}
                                    onChange={stops => setFormatter(col, { ...fmt, colorStops: stops })}
                                    addLabel={t('designer.kpi_add_stop')}
                                  />
                                  <label className="inline-flex items-center gap-1.5 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={!!fmt.background}
                                      onChange={e => setFormatter(col, { ...fmt, background: e.target.checked || undefined })}
                                      className="h-3.5 w-3.5"
                                    />
                                    <span className="text-slate-500 dark:text-slate-400">{t('designer.table_formatter_background')}</span>
                                  </label>
                                </div>
                              )}

                              {fmt.type === 'bar' && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.table_formatter_max')}:</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={fmt.max === 'auto' || fmt.max === undefined ? 'auto' : String(fmt.max)}
                                      onChange={e => {
                                        const v = e.target.value.replace(/,/g, '.').trim()
                                        if (v === '' || v === 'auto') setFormatter(col, { ...fmt, max: 'auto' })
                                        else if (Number.isFinite(Number(v))) setFormatter(col, { ...fmt, max: Number(v) })
                                      }}
                                      placeholder="auto"
                                      className="flex-1 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.table_formatter_color')}:</span>
                                    <input
                                      type="color"
                                      value={fmt.color || '#3b82f6'}
                                      onChange={e => setFormatter(col, { ...fmt, color: e.target.value })}
                                      className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                                    />
                                    <input
                                      type="text"
                                      value={fmt.color || ''}
                                      onChange={e => setFormatter(col, { ...fmt, color: e.target.value || undefined })}
                                      placeholder="#3b82f6"
                                      className="flex-1 text-xs px-1.5 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50 font-mono"
                                    />
                                  </div>
                                </div>
                              )}

                              {fmt.type === 'delta' && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 w-20">{t('designer.kpi_color_mode')}:</span>
                                    <select
                                      value={fmt.colorMode || 'sign'}
                                      onChange={e => setFormatter(col, { ...fmt, colorMode: e.target.value as 'sign' | 'none' })}
                                      className="input text-xs flex-1 py-0.5"
                                    >
                                      <option value="sign">{t('designer.table_formatter_delta_color_mode.sign')}</option>
                                      <option value="none">{t('designer.table_formatter_delta_color_mode.none')}</option>
                                    </select>
                                  </div>
                                  <label className="inline-flex items-center gap-1.5 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={fmt.showArrow !== false}
                                      onChange={e => setFormatter(col, { ...fmt, showArrow: e.target.checked })}
                                      className="h-3.5 w-3.5"
                                    />
                                    <span className="text-slate-500 dark:text-slate-400">{t('designer.table_formatter_show_arrow')}</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          ))}

                          {remainingCols.length > 0 && (
                            <select
                              value=""
                              onChange={e => {
                                const col = e.target.value
                                if (!col) return
                                setFormatter(col, defaultHeatmap)
                              }}
                              className="input text-xs"
                            >
                              <option value="">{t('designer.table_add_formatter')}</option>
                              {remainingCols.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          )}
                        </div>
                      )
                    })()}
                  </Field>
                </>
              )
            })()}

            {/* ── KPI Config ── */}
            {widget.widgetType === 'KPI' && (() => {
              return (
                <>
                  {availableCols.length > 0 && (
                    <>
                      <Field label={t('designer.kpi_value_column')}>
                        <select
                          value={cc.valueColumn as string || ''}
                          onChange={e => update({ chartConfig: { ...cc, valueColumn: e.target.value || undefined } })}
                          className="input text-sm"
                        >
                          <option value="">{t('designer.auto_first_column')}</option>
                          {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label={t('designer.kpi_aggregation')}>
                        <select
                          value={cc.aggregation as string || 'first'}
                          onChange={e => update({ chartConfig: { ...cc, aggregation: e.target.value } })}
                          className="input text-sm"
                        >
                          <option value="first">{t('designer.agg.first')}</option>
                          <option value="last">{t('designer.agg.last')}</option>
                          <option value="sum">{t('designer.agg.sum')}</option>
                          <option value="avg">{t('designer.agg.avg')}</option>
                          <option value="min">{t('designer.agg.min')}</option>
                          <option value="max">{t('designer.agg.max')}</option>
                          <option value="count">{t('designer.agg.count')}</option>
                        </select>
                      </Field>
                      <Field label={t('designer.kpi_label_column')}>
                        <select
                          value={cc.labelColumn as string || ''}
                          onChange={e => update({ chartConfig: { ...cc, labelColumn: e.target.value || undefined } })}
                          className="input text-sm"
                        >
                          <option value="">{t('common.none')}</option>
                          {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                    </>
                  )}
                  <Field label={t('designer.number_format')}>
                    <select
                      value={cc.format as string || 'number'}
                      onChange={e => update({ chartConfig: { ...cc, format: e.target.value } })}
                      className="input text-sm"
                    >
                      <option value="number">{t('designer.format.number')}</option>
                      <option value="thousands">{t('designer.format.thousands')}</option>
                      <option value="millions">{t('designer.format.millions')}</option>
                      <option value="billions">{t('designer.format.billions')}</option>
                      <option value="currency">{t('designer.format.currency')}</option>
                      <option value="percent">{t('designer.format.percent')}</option>
                    </select>
                  </Field>

                  <Field label={t('designer.kpi_decimals')}>
                    <NumericInput
                      value={cc.decimals as number | undefined}
                      onChange={v => update({
                        chartConfig: {
                          ...cc,
                          decimals: v != null ? Math.max(0, Math.min(6, Math.floor(v))) : undefined,
                        },
                      })}
                      className="input text-sm"
                      placeholder={t('designer.kpi_decimals_placeholder')}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{t('designer.kpi_decimals_hint')}</p>
                  </Field>

                  {cc.format === 'currency' && (
                    <Field label={t('designer.currency')}>
                      <select
                        value={cc.currency as string || 'USD'}
                        onChange={e => update({ chartConfig: { ...cc, currency: e.target.value } })}
                        className="input text-sm"
                      >
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>{c.symbol} {c.code} - {c.name}</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <Field label={t('designer.prefix_suffix')}>
                    <div className="flex gap-2">
                      <input
                        value={cc.prefix as string || ''}
                        onChange={e => update({ chartConfig: { ...cc, prefix: e.target.value } })}
                        placeholder={t('designer.prefix')} className="input text-sm flex-1"
                      />
                      <input
                        value={cc.suffix as string || ''}
                        onChange={e => update({ chartConfig: { ...cc, suffix: e.target.value } })}
                        placeholder={t('designer.suffix')} className="input text-sm flex-1"
                      />
                    </div>
                  </Field>

                  <Field label={t('designer.kpi_color_mode')}>
                    <select
                      value={cc.colorMode as string || 'step'}
                      onChange={e => update({ chartConfig: { ...cc, colorMode: e.target.value } })}
                      className="input text-sm"
                    >
                      <option value="step">{t('designer.kpi_color_mode.step')}</option>
                      <option value="gradient">{t('designer.kpi_color_mode.gradient')}</option>
                    </select>
                  </Field>

                  <Field label={t('designer.kpi_color_stops')}>
                    <ColorStopsEditor
                      stops={(cc.colorStops as Array<{ at: number; color: string }>) || []}
                      onChange={next => update({ chartConfig: { ...cc, colorStops: next.length ? next : undefined } })}
                      addLabel={t('designer.kpi_add_stop')}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{t('designer.kpi_color_stops_hint')}</p>
                  </Field>

                  <Field label={t('designer.kpi_tint_background')}>
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={!!cc.tintBackground}
                        onChange={e => update({ chartConfig: { ...cc, tintBackground: e.target.checked || undefined } })}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-slate-500 dark:text-slate-400">{t('designer.kpi_tint_background')}</span>
                    </label>
                  </Field>

                  {availableCols.length > 0 && (
                    <>
                      <Field label={t('designer.kpi_sparkline_field')}>
                        <select
                          value={cc.sparklineField as string || ''}
                          onChange={e => update({ chartConfig: { ...cc, sparklineField: e.target.value || undefined } })}
                          className="input text-sm"
                        >
                          <option value="">{t('common.none')}</option>
                          {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      {!!cc.sparklineField && (
                        <>
                          <Field label={t('designer.kpi_sparkline_color_from_stops')}>
                            <label className="inline-flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={!!cc.sparklineColorFromStops}
                                onChange={e => update({ chartConfig: { ...cc, sparklineColorFromStops: e.target.checked || undefined } })}
                                className="h-3.5 w-3.5"
                              />
                              <span className="text-slate-500 dark:text-slate-400">{t('designer.kpi_sparkline_color_from_stops')}</span>
                            </label>
                          </Field>
                          {!cc.sparklineColorFromStops && (
                            <Field label={t('designer.kpi_sparkline_color')}>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={cc.sparklineColor as string || '#3b82f6'}
                                  onChange={e => update({ chartConfig: { ...cc, sparklineColor: e.target.value } })}
                                  className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                                />
                                <input
                                  type="text"
                                  value={cc.sparklineColor as string || ''}
                                  onChange={e => update({ chartConfig: { ...cc, sparklineColor: e.target.value || undefined } })}
                                  placeholder="#3b82f6"
                                  className="input text-xs flex-1 font-mono"
                                />
                              </div>
                            </Field>
                          )}
                        </>
                      )}
                      <Field label={t('designer.kpi_delta_column')}>
                        <select
                          value={cc.deltaColumn as string || ''}
                          onChange={e => update({ chartConfig: { ...cc, deltaColumn: e.target.value || undefined } })}
                          className="input text-sm"
                        >
                          <option value="">{t('common.none')}</option>
                          {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                    </>
                  )}
                </>
              )
            })()}

            {/* ── FILTER Config ── */}
            {widget.widgetType === 'FILTER' && availableCols.length > 0 && (() => {
              return (
                <>
                  <Field label={t('designer.filter_column')}>
                    <select
                      value={cc.filterColumn as string || ''}
                      onChange={e => update({ chartConfig: { ...cc, filterColumn: e.target.value || undefined } })}
                      className="input text-sm"
                    >
                      <option value="">{t('designer.auto_first_column')}</option>
                      {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label={t('designer.filter_type')}>
                    <select
                      value={cc.filterType as string || 'select'}
                      onChange={e => update({ chartConfig: { ...cc, filterType: e.target.value } })}
                      className="input text-sm"
                    >
                      <option value="select">{t('designer.filter_types.select')}</option>
                      <option value="multi_select">{t('designer.filter_types.multi_select')}</option>
                      <option value="text">{t('designer.filter_types.text')}</option>
                      <option value="number_range">{t('designer.filter_types.number_range')}</option>
                      <option value="date_range">{t('designer.filter_types.date_range')}</option>
                    </select>
                  </Field>
                  <Field label={t('designer.filter_placeholder')}>
                    <input
                      value={cc.placeholder as string || ''}
                      onChange={e => update({ chartConfig: { ...cc, placeholder: e.target.value } })}
                      className="input text-sm"
                      placeholder={t('designer.filter_placeholder_hint')}
                    />
                  </Field>
                </>
              )
            })()}
          </>
        )
      })()}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
function AddColorValueRow({
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
function ColorStopsEditor({ stops, onChange, addLabel }: {
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
