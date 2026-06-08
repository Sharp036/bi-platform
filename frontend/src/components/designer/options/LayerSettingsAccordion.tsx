import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Plus, X, Trash2 } from 'lucide-react'
import NumericInput from '@/components/common/NumericInput'
import { interactiveApi } from '@/api/interactive'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { ChartLayerItem } from '@/types'
import { createLayerFor, deleteLayerFor, layerColor } from './layerOps'

const CURRENCIES = [
  { code: 'USD', symbol: '$' }, { code: 'EUR', symbol: '€' }, { code: 'GBP', symbol: '£' },
  { code: 'RUB', symbol: '₽' }, { code: 'CNY', symbol: '¥' }, { code: 'JPY', symbol: '¥' },
  { code: 'KRW', symbol: '₩' }, { code: 'INR', symbol: '₹' }, { code: 'BRL', symbol: 'R$' },
  { code: 'CHF', symbol: 'Fr' }, { code: 'CAD', symbol: 'C$' }, { code: 'AUD', symbol: 'A$' },
]

// Per-layer settings accordion for mixed/multi-series charts. Each layer is one
// series; settings are stored on the layer (color/type/axis/opacity) or its
// seriesConfig JSON (labels/smoothing/markers/thresholds). Y-axis format/min/
// decimals/currency are per-axis (left = base chartConfig key, right = key +
// "Right") because two layers sharing an axis share that axis' scale.
export default function LayerSettingsAccordion({ widget, cc, update, availableCols, categoryField }: {
  widget: DesignerWidget
  cc: Record<string, unknown>
  update: (updates: Partial<DesignerWidget>) => void
  availableCols: string[]
  categoryField?: string
}) {
  const { t } = useTranslation()
  const widgetLayersMap = useDesignerStore(s => s.widgetLayers)
  const updateWidgetLayer = useDesignerStore(s => s.updateWidgetLayer)
  const addWidgetLayer = useDesignerStore(s => s.addWidgetLayer)
  const removeWidgetLayer = useDesignerStore(s => s.removeWidgetLayer)
  const [expandedLayerIds, setExpandedLayerIds] = useState<Set<number>>(new Set())
  const toggleLayerExpand = (id: number) =>
    setExpandedLayerIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const layers = widgetLayersMap[widget.id] || []

  // Columns still available to add as a new series (excludes the category and
  // any column already bound to a layer).
  const usedFields = new Set(layers.map(l => l.valueField).filter(Boolean) as string[])
  const addableCols = availableCols.filter(c => c !== categoryField && !usedFields.has(c))
  const handleAddLayer = async (col: string) => {
    if (!col) return
    const layer = await createLayerFor(widget, {
      name: col, valueField: col, categoryField,
      chartType: 'line', axis: 'right',
      color: layerColor(layers.length), sortOrder: layers.length,
    })
    addWidgetLayer(widget.id, layer)
    toggleLayerExpand(layer.id)
  }
  const handleDeleteLayer = async (layer: ChartLayerItem) => {
    await deleteLayerFor(widget, layer)
    removeWidgetLayer(widget.id, layer.id)
  }

  const axisKey = (axis: string, suffix: string) =>
    axis === 'right' ? `yAxis${suffix}Right` : `yAxis${suffix}`
  const getAxisVal = (axis: string, suffix: string, def: unknown) =>
    (cc[axisKey(axis, suffix)] ?? def)
  const setAxisVal = (axis: string, suffix: string, val: unknown) =>
    update({ chartConfig: { ...cc, [axisKey(axis, suffix)]: val } })

  const patchLayer = async (layer: ChartLayerItem, patch: Partial<ChartLayerItem>) => {
    // Only push to the server for a saved widget. On an unsaved copy the layer
    // ids still belong to the source chart, so a server update would mutate the
    // source's layers; the store edit is enough and the copy's layers are
    // created on save.
    if (widget.serverId) {
      try { await interactiveApi.updateLayer(layer.id, { ...layer, ...patch }) } catch { /* silent */ }
    }
    updateWidgetLayer(widget.id, layer.id, patch)
  }
  const patchSeriesConfig = async (layer: ChartLayerItem, patch: Record<string, unknown>) => {
    const sc = { ...(layer.seriesConfig as Record<string, unknown> || {}), ...patch }
    await patchLayer(layer, { seriesConfig: sc })
  }

  return (
    <div className="space-y-1">
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
            <div className="w-full flex items-center hover:bg-surface-50 dark:hover:bg-dark-surface-50">
              <button
                type="button"
                onClick={() => toggleLayerExpand(layer.id)}
                className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-left"
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: layer.color || '#5470c6' }} />
                <span className="text-xs flex-1 truncate text-slate-700 dark:text-slate-300">{layer.label || layer.name}</span>
                <span className="text-[10px] text-slate-400">{layer.chartType} / {layer.axis}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLayer(layer)}
                className="px-1.5 py-1.5 text-slate-400 hover:text-red-500 flex-shrink-0"
                title={t('designer.layer_remove')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Accordion body */}
            {expanded && (
              <div className="px-2 pb-2 pt-1 space-y-2 border-t border-surface-200 dark:border-dark-surface-100 bg-surface-50/50 dark:bg-dark-surface-50/50">

                {/* Data binding: value + category column (lets a 1:1 copy be repointed) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{t('designer.layer_value')}</span>
                  <select value={layer.valueField || ''}
                    onChange={e => patchLayer(layer, { valueField: e.target.value || undefined })}
                    className="input text-xs flex-1">
                    <option value="">{t('common.none')}</option>
                    {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{t('designer.category_field')}</span>
                  <select value={layer.categoryField || ''}
                    onChange={e => patchLayer(layer, { categoryField: e.target.value || undefined })}
                    className="input text-xs flex-1">
                    <option value="">{t('designer.layer_category_inherit')}</option>
                    {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

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

      {/* Add a new series/layer from an unused value column */}
      {addableCols.length > 0 ? (
        <select
          value=""
          onChange={e => { handleAddLayer(e.target.value); e.target.value = '' }}
          className="input text-xs w-full mt-1"
        >
          <option value="">+ {t('designer.layer_add')}</option>
          {addableCols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : layers.length === 0 ? (
        <p className="text-[10px] text-slate-400 px-1 py-1">{t('designer.layer_add_hint')}</p>
      ) : null}
    </div>
  )
}
