import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import NumericInput from '@/components/common/NumericInput'
import type { DesignerWidget } from '@/store/useDesignerStore'
import { Field, ColorStopsEditor } from '@/components/designer/PropertyPanel'

// Chart types that render with axes and therefore can carry threshold lines /
// min-max markers. Kept local to this module so the marker section is
// self-contained.
const AXIS_CHART_TYPES = [
  'bar', 'line', 'area', 'scatter', 'waterfall', 'heatmap', 'boxplot',
  'candlestick',
]

// Marker / annotation options that apply to axis-based charts: threshold lines,
// min-max markers, per-bar conditional color, delta annotation, last-point
// highlight. Each block gates itself on the chart type, so the section renders
// only the controls relevant to the current type.
export default function ChartMarkerOptions({ cc, update, availableCols }: {
  cc: Record<string, unknown>
  update: (updates: Partial<DesignerWidget>) => void
  availableCols: string[]
}) {
  const { t } = useTranslation()
  return (
    <>
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
}
