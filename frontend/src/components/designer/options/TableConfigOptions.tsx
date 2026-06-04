import { useTranslation } from 'react-i18next'
import { CheckSquare, Square, ArrowUp, ArrowDown, X } from 'lucide-react'
import NumericInput from '@/components/common/NumericInput'
import type { DesignerWidget } from '@/store/useDesignerStore'
import { Field, AddColorValueRow, ColorStopsEditor } from '@/components/designer/PropertyPanel'

// TABLE widget configuration: visible columns (with per-column totals + manual
// ordering), density, page size, totals toggle, conditional row coloring, and
// per-column cell formatters (heatmap / in-cell bar / delta).
export default function TableConfigOptions({ widget, cc, update, availableCols, previewRows }: {
  widget: DesignerWidget
  cc: Record<string, unknown>
  update: (updates: Partial<DesignerWidget>) => void
  availableCols: string[]
  previewRows: Record<string, unknown>[]
}) {
  const { t } = useTranslation()
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
}
