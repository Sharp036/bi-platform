import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { SavedQuery, DataSource } from '@/types'
import { queryApi } from '@/api/queries'
import { datasourceApi } from '@/api/datasources'
import { buildDesignerParameterValues, mergeSqlParameterKeys } from '@/utils/designerParameters'
import { Trash2, Copy, Eye, EyeOff, RefreshCw, CheckSquare, Square, ToggleLeft, ArrowUp, ArrowDown } from 'lucide-react'
import toast from 'react-hot-toast'

const CHART_TYPES = ['bar', 'line', 'pie', 'area', 'scatter', 'radar', 'funnel', 'heatmap', 'treemap', 'sankey', 'boxplot', 'gauge', 'waterfall']

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

const AXIS_CHART_TYPES = ['bar', 'line', 'area', 'scatter', 'waterfall', 'heatmap', 'boxplot']

export default function PropertyPanel() {
  const { t } = useTranslation()
  const selected = useDesignerStore(s => s.selectedWidgetId)
  const widgets = useDesignerStore(s => s.widgets)
  const parameters = useDesignerStore(s => s.parameters)
  const updateWidget = useDesignerStore(s => s.updateWidget)
  const removeWidget = useDesignerStore(s => s.removeWidget)
  const duplicateWidget = useDesignerStore(s => s.duplicateWidget)

  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [availableCols, setAvailableCols] = useState<string[]>([])
  const [loadingCols, setLoadingCols] = useState(false)

  const widget = widgets.find(w => w.id === selected)

  useEffect(() => {
    queryApi.list({ size: 100 }).then(d => setQueries(d.content || [])).catch(() => {})
    datasourceApi.list().then(setDatasources).catch(() => {})
  }, [])

  // Auto-load columns when widget selection changes (for saved widgets with a data source)
  useEffect(() => { setAvailableCols([]) }, [selected])

  useEffect(() => {
    if (!widget) return
    const hasDataSource = !!(widget.queryId || (widget.datasourceId && widget.rawSql?.trim()))
    if (hasDataSource) loadColumns()
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadColumns = useCallback(async () => {
    if (!widget) return
    setLoadingCols(true)
    try {
      let paramValues = buildDesignerParameterValues(parameters)
      let res
      // Prefer inline SQL when present, even if stale queryId is still set.
      if (widget.datasourceId && widget.rawSql?.trim()) {
        paramValues = mergeSqlParameterKeys(widget.rawSql, paramValues)
        res = await queryApi.executeAdHoc({
          datasourceId: widget.datasourceId,
          sql: widget.rawSql,
          parameters: paramValues,
          limit: 1,
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
        res = await queryApi.execute(widget.queryId, paramValues, 1)
      }
      if (res?.columns) {
        const cols = res.columns.map((c: string | { name: string }) => typeof c === 'string' ? c : c.name)
        setAvailableCols(cols)

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

  return (
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
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-surface-100 dark:bg-dark-surface-100 text-slate-500">
          {widget.widgetType}
        </span>
      </div>

      {/* Title */}
      <Field label={t('designer.widget_title')}>
        <input
          value={widget.title} onChange={e => update({ title: e.target.value })}
          className="input text-sm" placeholder={t('designer.widget_title_placeholder')}
        />
      </Field>

      {/* Position & Size */}
      <Field label={t('designer.layout')}>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">X</label>
            <input type="number" min={0} max={11}
              value={widget.position.x} onChange={e => update({ position: { ...widget.position, x: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Y</label>
            <input type="number" min={0}
              value={widget.position.y} onChange={e => update({ position: { ...widget.position, y: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">W</label>
            <input type="number" min={1} max={12}
              value={widget.position.w} onChange={e => update({ position: { ...widget.position, w: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">H</label>
            <input type="number" min={1}
              value={widget.position.h} onChange={e => update({ position: { ...widget.position, h: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
        </div>
      </Field>

      <Field label="Layer (z-index)">
        <input
          type="number"
          value={Number((widget.style as Record<string, unknown>).zIndex ?? 0)}
          onChange={e => update({ style: { ...widget.style, zIndex: Number(e.target.value || 0) } })}
          className="input text-sm"
        />
      </Field>

      {/* Data Binding */}
      {widget.widgetType !== 'TEXT' && widget.widgetType !== 'IMAGE' && (() => {
        const cc = widget.chartConfig as Record<string, unknown>
        const hasDataSource = !!(widget.queryId || (widget.datasourceId && widget.rawSql?.trim()))

        return (
          <>
            <Field label={t('designer.data_source')}>
              <select
                value={widget.queryId || ''}
                onChange={e => {
                  const qId = e.target.value ? Number(e.target.value) : null
                  const q = queries.find(q => q.id === qId)
                  update({
                    queryId: qId,
                    datasourceId: q?.datasourceId || widget.datasourceId,
                    rawSql: qId ? '' : widget.rawSql,
                  })
                }}
                className="input text-sm"
              >
                <option value="">{t('designer.select_query')}</option>
                {queries.map(q => (
                  <option key={q.id} value={q.id}>{q.name} ({q.datasourceName})</option>
                ))}
              </select>
            </Field>

            <Field label={t('designer.inline_sql')}>
              <select
                value={widget.datasourceId || ''}
                onChange={e => update({
                  datasourceId: e.target.value ? Number(e.target.value) : null,
                  queryId: null,
                })}
                className="input text-sm mb-2"
              >
                <option value="">{t('designer.select_datasource')}</option>
                {datasources.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>
                ))}
              </select>
              <textarea
                value={widget.rawSql}
                onChange={e => update({ rawSql: e.target.value, queryId: null })}
                placeholder={t('designer.sql_placeholder')}
                className="input text-xs font-mono h-20 resize-none"
              />
            </Field>

            {/* Load Columns — shared for all data-bound types */}
            <Field label={t('designer.columns')}>
              <button
                onClick={loadColumns}
                disabled={loadingCols || !hasDataSource}
                className="btn-secondary text-xs w-full gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCols ? 'animate-spin' : ''}`} />
                {loadingCols ? t('designer.loading_columns') : t('designer.load_columns')}
              </button>
              {!hasDataSource && (
                <p className="text-[10px] text-slate-400 mt-1">{t('designer.no_data_source_hint')}</p>
              )}
            </Field>

            {/* ── CHART Config ── */}
            {widget.widgetType === 'CHART' && (() => {
              const catField = cc.categoryField as string || ''
              const valFields = cc.valueFields as string[] || []
              const regressionFields = cc.regressionFields as string[] || []
              const allNonCat = availableCols.filter(c => c !== (catField || availableCols[0]))
              const isAllSelected = !Array.isArray(cc.valueFields)
              const effectiveFields = isAllSelected ? allNonCat : valFields

              const handleToggleValue = (col: string) => {
                const current = isAllSelected ? [...allNonCat] : [...valFields]
                const next = current.includes(col)
                  ? current.filter(c => c !== col)
                  : [...current, col]
                if (next.length === allNonCat.length) {
                  const { valueFields: _, ...rest } = cc
                  update({ chartConfig: rest })
                } else {
                  update({ chartConfig: { ...cc, valueFields: next } })
                }
              }

              const handleToggleRegression = (col: string) => {
                const current = Array.isArray(regressionFields) ? [...regressionFields] : []
                const next = current.includes(col)
                  ? current.filter(c => c !== col)
                  : [...current, col]
                update({ chartConfig: { ...cc, regressionFields: next } })
              }

              return (
                <>
                  <Field label={t('charts.select_type')}>
                    <select
                      value={cc.type as string || 'bar'}
                      onChange={e => update({ chartConfig: { ...cc, type: e.target.value } })}
                      className="input text-sm"
                    >
                      {CHART_TYPES.map(ct => (
                        <option key={ct} value={ct}>{t(`charts.type.${ct}`, ct.charAt(0).toUpperCase() + ct.slice(1))}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label={t('designer.legend_position')}>
                    <select
                      value={cc.legendPosition as string || 'auto'}
                      onChange={e => update({ chartConfig: { ...cc, legendPosition: e.target.value } })}
                      className="input text-sm"
                    >
                      <option value="auto">{t('designer.legend_position.auto')}</option>
                      <option value="top">{t('designer.legend_position.top')}</option>
                      <option value="bottom">{t('designer.legend_position.bottom')}</option>
                      <option value="left">{t('designer.legend_position.left')}</option>
                      <option value="right">{t('designer.legend_position.right')}</option>
                      <option value="hidden">{t('designer.legend_position.hidden')}</option>
                    </select>
                  </Field>

                  {availableCols.length > 0 && (
                    <>
                      <Field label={t('designer.category_field')}>
                        <select
                          value={catField}
                          onChange={e => {
                            const { valueFields: _, ...rest } = cc
                            update({ chartConfig: { ...rest, categoryField: e.target.value || undefined } })
                          }}
                          className="input text-sm"
                        >
                          <option value="">{t('designer.auto_first_column')}</option>
                          {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>

                      <Field label={t('designer.value_fields')}>
                        <div className="flex items-center gap-1 mb-1">
                          <button
                            onClick={() => { const { valueFields: _, ...rest } = cc; update({ chartConfig: rest }) }}
                            className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5" title={t('designer.select_all')}
                          >
                            <CheckSquare className="w-3 h-3" /> {t('designer.select_all')}
                          </button>
                          <button
                            onClick={() => update({ chartConfig: { ...cc, valueFields: [] } })}
                            className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5" title={t('designer.deselect_all')}
                          >
                            <Square className="w-3 h-3" /> {t('designer.deselect_all')}
                          </button>
                          <button
                            onClick={() => {
                              const inverted = allNonCat.filter(c => !effectiveFields.includes(c))
                              if (inverted.length === allNonCat.length) {
                                const { valueFields: _, ...rest } = cc
                                update({ chartConfig: rest })
                              } else {
                                update({ chartConfig: { ...cc, valueFields: inverted } })
                              }
                            }}
                            className="btn-ghost text-[10px] px-1.5 py-0.5 gap-0.5" title={t('designer.invert')}
                          >
                            <ToggleLeft className="w-3 h-3" /> {t('designer.invert')}
                          </button>
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
                          {allNonCat.map(col => (
                            <label key={col} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-800 dark:hover:text-white">
                              <input
                                type="checkbox"
                                checked={isAllSelected || valFields.includes(col)}
                                onChange={() => handleToggleValue(col)}
                                className="rounded border-slate-300"
                              />
                              {col}
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{t('designer.value_fields_hint')}</p>
                      </Field>

                      <Field label={t('designer.regression_lines')}>
                        <div className="space-y-1 max-h-28 overflow-y-auto border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
                          {effectiveFields.map(col => (
                            <label key={col} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-800 dark:hover:text-white">
                              <input
                                type="checkbox"
                                checked={Array.isArray(regressionFields) && regressionFields.includes(col)}
                                onChange={() => handleToggleRegression(col)}
                                className="rounded border-slate-300"
                              />
                              {col}
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{t('designer.regression_lines_hint')}</p>
                      </Field>
                    </>
                  )}

                  {/* Chart Display Options */}
                  {AXIS_CHART_TYPES.includes(cc.type as string || 'bar') && (
                    <>
                      <Field label={t('designer.y_axis_format')}>
                        <select
                          value={cc.yAxisFormat as string || 'plain'}
                          onChange={e => update({ chartConfig: { ...cc, yAxisFormat: e.target.value } })}
                          className="input text-sm"
                        >
                          <option value="plain">{t('designer.axis_format.plain')}</option>
                          <option value="thousands">{t('designer.axis_format.thousands')}</option>
                          <option value="millions">{t('designer.axis_format.millions')}</option>
                          <option value="billions">{t('designer.axis_format.billions')}</option>
                          <option value="currency">{t('designer.axis_format.currency')}</option>
                          <option value="percent">{t('designer.axis_format.percent')}</option>
                        </select>
                      </Field>

                      {['thousands', 'millions', 'billions', 'currency', 'percent'].includes((cc.yAxisFormat as string) || 'plain') && (
                        <Field label={t('designer.y_axis_decimals')}>
                          <input
                            type="number" min={0} max={6}
                            value={cc.yAxisDecimals != null ? Number(cc.yAxisDecimals) : ''}
                            onChange={e => update({
                              chartConfig: {
                                ...cc,
                                yAxisDecimals: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })}
                            className="input text-sm"
                            placeholder="0"
                          />
                        </Field>
                      )}

                      {cc.yAxisFormat === 'currency' && (
                        <Field label={t('designer.currency')}>
                          <select
                            value={cc.yAxisCurrency as string || 'USD'}
                            onChange={e => update({ chartConfig: { ...cc, yAxisCurrency: e.target.value } })}
                            className="input text-sm"
                          >
                            {CURRENCIES.map(c => (
                              <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
                            ))}
                          </select>
                        </Field>
                      )}

                      <Field label={t('designer.x_axis_rotation')}>
                        <select
                          value={String(cc.xAxisRotation || 0)}
                          onChange={e => update({ chartConfig: { ...cc, xAxisRotation: Number(e.target.value) } })}
                          className="input text-sm"
                        >
                          <option value="0">{t('designer.rotation.horizontal')}</option>
                          <option value="45">{t('designer.rotation.angled')}</option>
                          <option value="90">{t('designer.rotation.vertical')}</option>
                        </select>
                      </Field>
                    </>
                  )}

                  <Field label={t('designer.data_labels')}>
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
                          <input
                            type="number" min={1} max={100}
                            value={cc.dataLabelCount as number || 3}
                            onChange={e => update({ chartConfig: { ...cc, dataLabelCount: Number(e.target.value) } })}
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
                          <input
                            type="number" min={0} max={6}
                            value={cc.dataLabelDecimals != null ? Number(cc.dataLabelDecimals) : 1}
                            onChange={e => update({ chartConfig: { ...cc, dataLabelDecimals: Number(e.target.value) } })}
                            className="input text-sm w-16"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{t('designer.data_label_decimals')}</span>
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
                  </Field>
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
                    <div className="space-y-0.5 max-h-44 overflow-y-auto border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
                      {(isAllVisible ? availableCols : [...visibleCols, ...availableCols.filter(c => !visibleCols.includes(c))]).map(col => (
                        <div key={col} className="flex items-center gap-1 group">
                          <input
                            type="checkbox"
                            checked={isAllVisible || effectiveCols.includes(col)}
                            onChange={() => handleToggleCol(col)}
                            className="rounded border-slate-300"
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">{col}</span>
                          {!isAllVisible && effectiveCols.includes(col) && (
                            <span className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                              <button onClick={() => moveCol(col, -1)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                                <ArrowUp className="w-3 h-3 text-slate-400" />
                              </button>
                              <button onClick={() => moveCol(col, 1)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                                <ArrowDown className="w-3 h-3 text-slate-400" />
                              </button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{t('designer.table_columns_hint')}</p>
                  </Field>

                  <Field label={t('designer.table_page_size')}>
                    <input
                      type="number" min={0} max={1000}
                      value={cc.tablePageSize as number || ''}
                      onChange={e => update({ chartConfig: { ...cc, tablePageSize: e.target.value ? Number(e.target.value) : undefined } })}
                      className="input text-sm"
                      placeholder={t('designer.table_page_size_auto')}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{t('designer.table_page_size_hint')}</p>
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
                      <option value="currency">{t('designer.format.currency')}</option>
                      <option value="percent">{t('designer.format.percent')}</option>
                    </select>
                  </Field>
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

      {/* Text content */}
      {widget.widgetType === 'TEXT' && (
        <Field label={t('designer.content_html')}>
          <textarea
            value={widget.title}
            onChange={e => update({ title: e.target.value })}
            className="input text-sm h-32 resize-none font-mono"
            placeholder={t('designer.html_placeholder')}
          />
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
