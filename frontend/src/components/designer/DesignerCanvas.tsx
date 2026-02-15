import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import { useTranslation } from 'react-i18next'
import { BarChart3, Table, Hash, Type, Filter, ImageIcon, GripVertical, EyeOff, Play } from 'lucide-react'
import { queryApi } from '@/api/queries'
import EChartWidget from '@/components/charts/EChartWidget'
import TableWidget from '@/components/charts/TableWidget'
import type { WidgetData } from '@/types'
import clsx from 'clsx'
import { useState, useCallback } from 'react'

const ICON_MAP: Record<string, React.ElementType> = {
  CHART: BarChart3, TABLE: Table, KPI: Hash,
  TEXT: Type, FILTER: Filter, IMAGE: ImageIcon,
}

const ROW_HEIGHT = 70   // px per grid row unit
const COLS = 12

export default function DesignerCanvas() {
  const { t } = useTranslation()
  const widgets = useDesignerStore(s => s.widgets)
  const selectedId = useDesignerStore(s => s.selectedWidgetId)
  const selectWidget = useDesignerStore(s => s.selectWidget)
  const previewMode = useDesignerStore(s => s.previewMode)

  // Calculate total canvas height
  const maxY = widgets.length > 0
    ? Math.max(...widgets.map(w => (w.position.y + w.position.h)))
    : 4
  const canvasHeight = Math.max(maxY * ROW_HEIGHT + 100, 400)

  return (
    <div
      className="relative bg-white dark:bg-dark-surface-50 rounded-xl border-2 border-dashed border-surface-200 dark:border-dark-surface-100"
      style={{ minHeight: `${canvasHeight}px` }}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectWidget(null)
      }}
    >
      {/* Grid lines (subtle) */}
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        backgroundSize: `${100 / COLS}% ${ROW_HEIGHT}px`,
        backgroundImage: 'linear-gradient(to right, rgb(148 163 184 / 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.15) 1px, transparent 1px)',
      }} />

      {/* Widgets */}
      {widgets.map(widget => (
        <WidgetBlock
          key={widget.id}
          widget={widget}
          isSelected={widget.id === selectedId}
          onSelect={() => selectWidget(widget.id)}
          previewMode={previewMode}
        />
      ))}

      {/* Empty state */}
      {widgets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500">
          <div className="text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('designer.canvas_hint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function WidgetBlock({
  widget, isSelected, onSelect, previewMode,
}: {
  widget: DesignerWidget
  isSelected: boolean
  onSelect: () => void
  previewMode: boolean
}) {
  const { t } = useTranslation()
  const Icon = ICON_MAP[widget.widgetType] || BarChart3
  const colWidth = 100 / COLS

  const [previewData, setPreviewData] = useState<WidgetData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const hasDataSource = !!(widget.queryId || (widget.datasourceId && widget.rawSql?.trim()))

  const loadPreview = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasDataSource) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      let res
      if (widget.queryId) {
        res = await queryApi.execute(widget.queryId, undefined, 100)
      } else if (widget.datasourceId && widget.rawSql?.trim()) {
        res = await queryApi.executeAdHoc({ datasourceId: widget.datasourceId, sql: widget.rawSql, limit: 100 })
      }
      if (res) {
        const cols = res.columns?.map((c: string | { name: string }) => typeof c === 'string' ? c : c.name) || []
        setPreviewData({
          columns: cols,
          rows: res.rows || [],
          rowCount: res.rowCount || res.rows?.length || 0,
          executionMs: res.executionTimeMs || 0,
        })
      }
    } catch {
      setPreviewError(t('designer.preview_failed'))
    } finally {
      setPreviewLoading(false)
    }
  }, [widget.queryId, widget.datasourceId, widget.rawSql, hasDataSource, t])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${widget.position.x * colWidth}%`,
    top: `${widget.position.y * ROW_HEIGHT}px`,
    width: `${widget.position.w * colWidth}%`,
    height: `${widget.position.h * ROW_HEIGHT}px`,
    padding: '4px',
  }

  if (!widget.isVisible && !previewMode) {
    // Show as ghost in design mode
  }

  const cc = widget.chartConfig as Record<string, unknown>
  const chartConfigStr = widget.widgetType === 'CHART' && previewData ? JSON.stringify(cc) : undefined

  // Build filtered data for TABLE preview (apply visibleColumns)
  const tablePreviewData = widget.widgetType === 'TABLE' && previewData ? (() => {
    const visCols = cc.visibleColumns as string[] | undefined
    const cols = Array.isArray(visCols) && visCols.length > 0
      ? visCols.filter(c => previewData.columns.includes(c))
      : previewData.columns
    return { ...previewData, columns: cols }
  })() : null

  // Build KPI preview value
  const kpiPreview = widget.widgetType === 'KPI' && previewData ? (() => {
    const valCol = (cc.valueColumn as string) || previewData.columns[0]
    const rows = previewData.rows || []
    if (rows.length === 0) return null
    const agg = (cc.aggregation as string) || 'first'
    const values = rows.map(r => Number(r[valCol]) || 0)
    let value: number
    switch (agg) {
      case 'sum': value = values.reduce((a, b) => a + b, 0); break
      case 'avg': value = values.reduce((a, b) => a + b, 0) / values.length; break
      case 'min': value = Math.min(...values); break
      case 'max': value = Math.max(...values); break
      case 'count': value = rows.length; break
      case 'last': value = values[values.length - 1]; break
      default: value = values[0]
    }
    const fmt = cc.format as string || 'number'
    let display: string
    if (fmt === 'currency') display = value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    else if (fmt === 'percent') display = (value * 100).toFixed(1) + '%'
    else display = value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    const prefix = (cc.prefix as string) || ''
    const suffix = (cc.suffix as string) || ''
    const labelCol = cc.labelColumn as string | undefined
    const label = labelCol && rows[0] ? String(rows[0][labelCol] ?? '') : undefined
    return { display: `${prefix}${display}${suffix}`, label }
  })() : null

  // FILTER preview: show distinct values
  const filterPreview = widget.widgetType === 'FILTER' && previewData ? (() => {
    const filterCol = (cc.filterColumn as string) || previewData.columns[0]
    if (!filterCol) return null
    const values = [...new Set(previewData.rows.map(r => String(r[filterCol] ?? '')))].slice(0, 10)
    return { column: filterCol, values, filterType: (cc.filterType as string) || 'select' }
  })() : null

  return (
    <div style={style} onClick={(e) => { e.stopPropagation(); onSelect() }}>
      <div className={clsx(
        'h-full rounded-lg border-2 transition-all cursor-pointer overflow-hidden flex flex-col',
        isSelected
          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20 shadow-lg shadow-brand-200/50 dark:shadow-brand-900/30'
          : 'border-surface-200 dark:border-dark-surface-100 bg-white dark:bg-dark-surface-50 hover:border-brand-300 dark:hover:border-brand-700',
        !widget.isVisible && 'opacity-40',
      )}>
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-surface-100 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/50 flex-shrink-0">
          <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 cursor-grab" />
          <Icon className="w-3.5 h-3.5 text-brand-500" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
            {widget.title || widget.widgetType}
          </span>
          {hasDataSource && !previewData && (
            <button
              onClick={loadPreview}
              disabled={previewLoading}
              className="p-0.5 rounded hover:bg-brand-100 dark:hover:bg-brand-900/30 text-brand-500"
              title={t('designer.load_preview')}
            >
              <Play className={`w-3 h-3 ${previewLoading ? 'animate-pulse' : ''}`} />
            </button>
          )}
          {!widget.isVisible && <EyeOff className="w-3 h-3 text-slate-400" />}
        </div>

        {/* Body */}
        <div className="flex-1 flex items-center justify-center p-2 min-h-0">
          {/* CHART preview */}
          {widget.widgetType === 'CHART' && previewData ? (
            <div className="w-full h-full">
              <EChartWidget data={previewData} chartConfig={chartConfigStr} />
            </div>
          ) : /* TABLE preview */
          tablePreviewData ? (
            <div className="w-full h-full overflow-hidden">
              <TableWidget data={tablePreviewData} />
            </div>
          ) : /* KPI preview */
          kpiPreview ? (
            <div className="text-center w-full">
              <p className="text-2xl font-bold text-slate-800 dark:text-white truncate">
                {kpiPreview.display}
              </p>
              {kpiPreview.label && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{kpiPreview.label}</p>
              )}
            </div>
          ) : /* FILTER preview */
          filterPreview ? (
            <div className="w-full">
              <p className="text-[10px] text-slate-400 mb-1">{filterPreview.column}</p>
              {filterPreview.filterType === 'select' || filterPreview.filterType === 'multi_select' ? (
                <select className="input text-xs w-full" disabled>
                  <option>— {filterPreview.values.length} {t('designer.filter_values')} —</option>
                  {filterPreview.values.map(v => <option key={v}>{v}</option>)}
                </select>
              ) : filterPreview.filterType === 'text' ? (
                <input className="input text-xs w-full" disabled placeholder={cc.placeholder as string || filterPreview.column} />
              ) : (
                <div className="flex gap-1">
                  <input className="input text-xs flex-1" disabled placeholder="min" />
                  <input className="input text-xs flex-1" disabled placeholder="max" />
                </div>
              )}
            </div>
          ) : /* TEXT */
          widget.widgetType === 'TEXT' ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 overflow-hidden line-clamp-4 w-full"
                 dangerouslySetInnerHTML={{ __html: widget.title || '<p>Text content</p>' }} />
          ) : /* IMAGE */
          widget.widgetType === 'IMAGE' && ((cc.src as string) || (cc.url as string)) ? (
            <img
              src={(cc.src as string) || (cc.url as string)}
              alt={widget.title}
              className="max-h-full max-w-full object-contain"
            />
          ) : previewError ? (
            <p className="text-[10px] text-red-400">{previewError}</p>
          ) : (
            <div className="text-center">
              <Icon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {widget.queryId ? `Query #${widget.queryId}` : widget.rawSql ? t('designer.inline_sql_badge') : t('designer.no_data_bound')}
              </p>
              {hasDataSource && (
                <button
                  onClick={loadPreview}
                  disabled={previewLoading}
                  className="mt-1 text-[10px] text-brand-500 hover:text-brand-600 flex items-center gap-0.5 mx-auto"
                >
                  <Play className="w-3 h-3" /> {previewLoading ? t('designer.loading_columns') : t('designer.load_preview')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
