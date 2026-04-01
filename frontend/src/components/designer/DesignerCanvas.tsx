import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { DesignerContainer } from './ContainerDesigner'
import { useTranslation } from 'react-i18next'
import { BarChart3, Table, Hash, Type, Filter, ImageIcon, GripVertical, EyeOff, Play, ChevronDown, ChevronRight, Eye, Layers } from 'lucide-react'
import { queryApi } from '@/api/queries'
import { buildDesignerParameterValues } from '@/utils/designerParameters'
import EChartWidget from '@/components/charts/EChartWidget'
import TableWidget from '@/components/charts/TableWidget'
import type { WidgetData } from '@/types'
import clsx from 'clsx'
import { useState, useCallback, useRef } from 'react'

const ICON_MAP: Record<string, React.ElementType> = {
  CHART: BarChart3, TABLE: Table, KPI: Hash,
  TEXT: Type, FILTER: Filter, IMAGE: ImageIcon,
}

const ROW_HEIGHT = 70   // px per grid row unit
const COLS = 12

interface DesignerCanvasProps {
  containers?: DesignerContainer[]
}

export default function DesignerCanvas({ containers = [] }: DesignerCanvasProps) {
  const { t } = useTranslation()
  const widgets = useDesignerStore(s => s.widgets)
  const selectedId = useDesignerStore(s => s.selectedWidgetId)
  const selectWidget = useDesignerStore(s => s.selectWidget)
  const previewMode = useDesignerStore(s => s.previewMode)
  const parameters = useDesignerStore(s => s.parameters)
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(new Set())
  const [showLayers, setShowLayers] = useState(false)

  const toggleLayerVisibility = useCallback((id: string) => {
    setHiddenLayerIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Widgets that live inside a container
  const widgetIdsInContainers = new Set(containers.flatMap(c => c.tabGroups.flat()))

  // Widgets not assigned to any container -> flat grid
  const freeWidgets = widgets.filter(w => !widgetIdsInContainers.has(w.id))

  // Canvas height for the free-widget grid
  const maxY = freeWidgets.length > 0
    ? Math.max(...freeWidgets.map(w => w.position.y + w.position.h))
    : 0
  const freeCanvasHeight = freeWidgets.length > 0
    ? Math.max(maxY * ROW_HEIGHT + 100, 200)
    : 0

  const sharedProps = { parameters, selectedId, onSelect: selectWidget, previewMode }

  return (
    <div
      className="relative bg-white dark:bg-dark-surface-50 rounded-xl border-2 border-dashed border-surface-200 dark:border-dark-surface-100 overflow-hidden"
      onClick={(e) => { if (e.target === e.currentTarget) selectWidget(null) }}
    >
      {/* ── Containers ── */}
      {containers.map(c => (
        <ContainerBlock key={c.clientId} container={c} widgets={widgets} {...sharedProps} hiddenLayerIds={hiddenLayerIds} />
      ))}

      {/* ── Free widget grid ── */}
      {freeWidgets.length > 0 && (
        <div
          className={clsx(
            'relative',
            containers.length > 0 && 'border-t-2 border-dashed border-surface-200 dark:border-dark-surface-100 mt-2 pt-2',
          )}
          style={{ minHeight: `${freeCanvasHeight}px` }}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{
            backgroundSize: `${100 / COLS}% ${ROW_HEIGHT}px`,
            backgroundImage: 'linear-gradient(to right, rgb(148 163 184 / 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.15) 1px, transparent 1px)',
          }} />
          {freeWidgets.filter(w => !hiddenLayerIds.has(w.id)).map(widget => (
            <WidgetBlock key={widget.id} widget={widget} {...sharedProps} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {widgets.length === 0 && containers.length === 0 && (
        <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
          <div className="text-center text-slate-400 dark:text-slate-500">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('designer.canvas_hint')}</p>
          </div>
        </div>
      )}
      {/* ── Layer panel toggle ── */}
      {!previewMode && widgets.length > 1 && (
        <div className="absolute bottom-3 right-3 z-20">
          {showLayers ? (
            <div className="bg-white dark:bg-dark-surface-50 rounded-lg shadow-xl border border-surface-200 dark:border-dark-surface-100 w-64 max-h-64 flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-surface-200 dark:border-dark-surface-100">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> {t('designer.layers')}
                </span>
                <button onClick={() => setShowLayers(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-1">
                {widgets.map(w => {
                  const Icon = ICON_MAP[w.widgetType] || BarChart3
                  const isHidden = hiddenLayerIds.has(w.id)
                  const isSelected = w.id === selectedId
                  return (
                    <div
                      key={w.id}
                      className={clsx(
                        'flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer',
                        isSelected ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-surface-50 dark:hover:bg-dark-surface-100'
                      )}
                      onClick={() => selectWidget(w.id)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(w.id) }}
                        className={clsx('flex-shrink-0', isHidden ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400')}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <Icon className={clsx('w-3.5 h-3.5 flex-shrink-0', isHidden ? 'text-slate-300' : 'text-brand-500')} />
                      <span className={clsx('flex-1 truncate', isHidden ? 'text-slate-400 line-through' : isSelected ? 'text-brand-700 dark:text-brand-400 font-medium' : 'text-slate-700 dark:text-slate-300')}>
                        {w.title || `Widget #${w.id.slice(0, 6)}`}
                      </span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">z{String((w.style as Record<string, unknown>)?.zIndex ?? 0)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLayers(true)}
              className="p-2 bg-white dark:bg-dark-surface-50 rounded-lg shadow-lg border border-surface-200 dark:border-dark-surface-100 text-slate-500 hover:text-brand-600 transition-colors"
              title={t('designer.layers')}
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Container block (tabs or accordion) ──────────────────────────────────────

function ContainerBlock({
  container, widgets, parameters, selectedId, onSelect, previewMode, hiddenLayerIds,
}: {
  container: DesignerContainer
  widgets: DesignerWidget[]
  parameters: Array<{ name: string; paramType: string; defaultValue: string }>
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewMode: boolean
  hiddenLayerIds: Set<string>
}) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(0)
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set([0]))

  const resolveGroup = (groupIdx: number): DesignerWidget[] =>
    (container.tabGroups[groupIdx] || [])
      .map(id => widgets.find(w => w.id === id))
      .filter((w): w is DesignerWidget => !!w)

  const sharedProps = { parameters, selectedId, onSelect, previewMode, insideContainer: true }

  // Render widgets with absolute positioning (same as free widget grid)
  const renderAbsolute = (group: DesignerWidget[]) => {
    const visible = group.filter(w => !hiddenLayerIds.has(w.id))
    if (group.length === 0) return null
    const maxY = Math.max(...group.map(w => w.position.y + w.position.h))
    return (
      <div className="relative" style={{ minHeight: `${maxY * ROW_HEIGHT}px` }}>
        {visible.map(w => <WidgetBlock key={w.id} widget={w} {...sharedProps} />)}
      </div>
    )
  }

  return (
    <div className="border-2 border-brand-200 dark:border-brand-800 rounded-xl m-3 overflow-hidden">
      {/* Container header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200 dark:border-brand-800">
        <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 flex-1">{container.name}</span>
        <span className="text-[10px] text-brand-400 uppercase tracking-wide">
          {container.containerType === 'ACCORDION'
            ? t('designer.tabs.type.accordion')
            : t('designer.tabs.type.tabs')}
        </span>
      </div>

      {container.containerType === 'TABS' ? (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-surface-200 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/40">
            {container.tabNames.map((name, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={clsx(
                  'px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                  i === activeTab
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                {name || `${t('designer.tabs.tab_name_placeholder')} ${i + 1}`}
              </button>
            ))}
          </div>
          {/* Active tab content */}
          {(() => {
            const group = resolveGroup(activeTab)
            if (group.length === 0) return (
              <div className="flex items-center justify-center h-24 text-xs text-slate-400">
                {t('designer.tabs.add_widget')}
              </div>
            )
            return <div>{renderAbsolute(group)}</div>
          })()}
        </>
      ) : (
        /* ACCORDION */
        <div>
          {container.tabNames.map((name, i) => {
            const expanded = expandedSet.has(i)
            const group = resolveGroup(i)
            return (
              <div key={i} className="border-b border-surface-100 dark:border-dark-surface-100 last:border-0">
                <button
                  onClick={() => setExpandedSet(prev => {
                    const next = new Set(prev)
                    next.has(i) ? next.delete(i) : next.add(i)
                    return next
                  })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
                >
                  {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {name || `${t('designer.tabs.tab_name_placeholder')} ${i + 1}`}
                </button>
                {expanded && (
                  <div className="border-t border-surface-100 dark:border-dark-surface-100">
                    {group.length === 0 ? (
                      <div className="flex items-center justify-center h-16 text-xs text-slate-400">
                        {t('designer.tabs.add_widget')}
                      </div>
                    ) : renderAbsolute(group)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Widget block ──────────────────────────────────────────────────────────────

function WidgetBlock({
  widget, parameters, selectedId, onSelect, previewMode, insideContainer, rowRelative,
}: {
  widget: DesignerWidget
  parameters: Array<{ name: string; paramType: string; defaultValue: string }>
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewMode: boolean
  insideContainer?: boolean
  rowRelative?: boolean  // inside container row: use x for left, ignore y (row handles vertical)
}) {
  const { t } = useTranslation()
  const Icon = ICON_MAP[widget.widgetType] || BarChart3
  const colWidth = 100 / COLS
  const isSelected = widget.id === selectedId

  const moveWidget = useDesignerStore(s => s.moveWidget)
  const outerRef = useRef<HTMLDivElement>(null)
  const [dragPos, setDragPos] = useState<typeof widget.position | null>(null)

  type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

  const calcPos = (startPos: typeof widget.position, dCol: number, dRow: number, mode: DragMode) => {
    if (mode === 'move') {
      return {
        ...startPos,
        x: Math.max(0, Math.min(COLS - startPos.w, startPos.x + dCol)),
        y: Math.max(0, startPos.y + dRow),
      }
    }
    const resizeN = mode === 'n' || mode === 'nw' || mode === 'ne'
    const resizeS = mode === 's' || mode === 'sw' || mode === 'se'
    const resizeW = mode === 'w' || mode === 'nw' || mode === 'sw'
    const resizeE = mode === 'e' || mode === 'ne' || mode === 'se'

    let { x, y, w, h } = startPos

    if (resizeE) w = Math.max(1, Math.min(COLS - x, w + dCol))
    if (resizeS) h = Math.max(1, h + dRow)

    if (resizeW) {
      const maxLeft = Math.min(dCol, w - 1)  // can't shrink below 1
      const newX = Math.max(0, x + maxLeft)
      w = w - (newX - x)
      x = newX
    }
    if (resizeN) {
      const maxUp = Math.min(dRow, h - 1)
      const newY = Math.max(0, y + maxUp)
      h = h - (newY - y)
      y = newY
    }

    return { x, y, w, h }
  }

  const startDrag = useCallback((e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault()
    e.stopPropagation()
    const parent = outerRef.current?.parentElement
    if (!parent) return
    const colPx = parent.getBoundingClientRect().width / COLS
    const startX = e.clientX
    const startY = e.clientY
    const startPos = { ...widget.position }

    const onMove = (me: MouseEvent) => {
      const dCol = Math.round((me.clientX - startX) / colPx)
      const dRow = Math.round((me.clientY - startY) / ROW_HEIGHT)
      setDragPos(calcPos(startPos, dCol, dRow, mode))
    }

    const onUp = (ue: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const dCol = Math.round((ue.clientX - startX) / colPx)
      const dRow = Math.round((ue.clientY - startY) / ROW_HEIGHT)
      moveWidget(widget.id, calcPos(startPos, dCol, dRow, mode))
      setDragPos(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [widget.id, widget.position, moveWidget])

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
      const paramValues = buildDesignerParameterValues(parameters)
      let res
      if (widget.datasourceId && widget.rawSql?.trim()) {
        res = await queryApi.executeAdHoc({
          datasourceId: widget.datasourceId,
          sql: widget.rawSql,
          parameters: paramValues,
          limit: 100,
        })
      } else if (widget.queryId) {
        res = await queryApi.execute(widget.queryId, paramValues, 100)
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
  }, [widget.queryId, widget.datasourceId, widget.rawSql, hasDataSource, parameters, t])

  const dp = dragPos || widget.position
  const zIdx = Number((widget.style as Record<string, unknown>)?.zIndex ?? (isSelected ? 10 : 1))
  const style: React.CSSProperties = rowRelative ? {
    position: 'absolute',
    left: `${dp.x * colWidth}%`,
    top: 0,
    width: `${dp.w * colWidth}%`,
    height: `${dp.h * ROW_HEIGHT}px`,
    padding: '4px',
    zIndex: dragPos ? 50 : zIdx,
    opacity: dragPos ? 0.85 : 1,
    transition: dragPos ? 'none' : undefined,
  } : {
    position: 'absolute',
    left: `${dp.x * colWidth}%`,
    top: `${dp.y * ROW_HEIGHT}px`,
    width: `${dp.w * colWidth}%`,
    height: `${dp.h * ROW_HEIGHT}px`,
    padding: '4px',
    zIndex: dragPos ? 50 : zIdx,
    opacity: dragPos ? 0.85 : 1,
    transition: dragPos ? 'none' : undefined,
  }

  const cc = widget.chartConfig as Record<string, unknown>
  const chartConfigStr = (widget.widgetType === 'CHART' || widget.widgetType === 'TABLE') && previewData ? JSON.stringify(cc) : undefined

  const tablePreviewData = widget.widgetType === 'TABLE' && previewData ? (() => {
    const visCols = cc.visibleColumns as string[] | undefined
    const cols = Array.isArray(visCols) && visCols.length > 0
      ? visCols.filter(c => previewData.columns.includes(c))
      : previewData.columns
    return { ...previewData, columns: cols }
  })() : null

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

  const filterPreview = widget.widgetType === 'FILTER' && previewData ? (() => {
    const filterCol = (cc.filterColumn as string) || previewData.columns[0]
    if (!filterCol) return null
    const values = [...new Set(previewData.rows.map(r => String(r[filterCol] ?? '')))].slice(0, 10)
    return { column: filterCol, values, filterType: (cc.filterType as string) || 'select' }
  })() : null

  return (
    <div ref={outerRef} style={style} className="relative" onClick={(e) => { e.stopPropagation(); onSelect(widget.id) }}>
      <div className={clsx(
        'h-full rounded-lg border-2 transition-all cursor-pointer overflow-hidden flex flex-col',
        isSelected
          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20 shadow-lg shadow-brand-200/50 dark:shadow-brand-900/30'
          : 'border-surface-200 dark:border-dark-surface-100 bg-white dark:bg-dark-surface-50 hover:border-brand-300 dark:hover:border-brand-700',
        !widget.isVisible && 'opacity-40',
      )}>
        {/* Header (draggable for move) */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 border-b border-surface-100 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/50 flex-shrink-0 cursor-grab active:cursor-grabbing"
          onMouseDown={!previewMode ? (e) => startDrag(e, 'move') : undefined}
        >
          <GripVertical
            className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0"
          />
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
          {widget.widgetType === 'CHART' && previewData ? (
            <div className="w-full h-full">
              <EChartWidget data={previewData} chartConfig={chartConfigStr} />
            </div>
          ) : tablePreviewData ? (
            <div className="w-full h-full overflow-hidden">
              <TableWidget data={tablePreviewData} chartConfig={chartConfigStr} />
            </div>
          ) : kpiPreview ? (
            <div className="text-center w-full">
              <p className="text-2xl font-bold text-slate-800 dark:text-white truncate">{kpiPreview.display}</p>
              {kpiPreview.label && <p className="text-xs text-slate-400 mt-0.5 truncate">{kpiPreview.label}</p>}
            </div>
          ) : filterPreview ? (
            <div className="w-full">
              <p className="text-[10px] text-slate-400 mb-1">{filterPreview.column}</p>
              {filterPreview.filterType === 'select' || filterPreview.filterType === 'multi_select' ? (
                <select className="input text-xs w-full" disabled>
                  <option>-- {filterPreview.values.length} {t('designer.filter_values')} --</option>
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
          ) : widget.widgetType === 'TEXT' ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 overflow-hidden line-clamp-4 w-full"
                 dangerouslySetInnerHTML={{ __html: widget.title || '<p>Text content</p>' }} />
          ) : widget.widgetType === 'IMAGE' && ((cc.src as string) || (cc.url as string)) ? (
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

      {/* Resize handles: on the OUTER div so overflow-hidden doesn't clip them */}
      {!previewMode && (<>
        {/* Edges -- 6px wide/tall invisible strips along each border */}
        <div className="absolute top-0 left-3 right-3 h-[6px] cursor-n-resize z-10" onMouseDown={(e) => startDrag(e, 'n')} />
        <div className="absolute bottom-0 left-3 right-3 h-[6px] cursor-s-resize z-10" onMouseDown={(e) => startDrag(e, 's')} />
        <div className="absolute top-3 bottom-3 left-0 w-[6px] cursor-w-resize z-10" onMouseDown={(e) => startDrag(e, 'w')} />
        <div className="absolute top-3 bottom-3 right-0 w-[6px] cursor-e-resize z-10" onMouseDown={(e) => startDrag(e, 'e')} />
        {/* Corners -- 10x10px squares at each corner */}
        <div className="absolute top-0 left-0 w-[10px] h-[10px] cursor-nw-resize z-20" onMouseDown={(e) => startDrag(e, 'nw')} />
        <div className="absolute top-0 right-0 w-[10px] h-[10px] cursor-ne-resize z-20" onMouseDown={(e) => startDrag(e, 'ne')} />
        <div className="absolute bottom-0 left-0 w-[10px] h-[10px] cursor-sw-resize z-20" onMouseDown={(e) => startDrag(e, 'sw')} />
        <div className="absolute bottom-0 right-0 w-[10px] h-[10px] cursor-se-resize z-20" onMouseDown={(e) => startDrag(e, 'se')}>
          <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-b-2 border-r-2 border-slate-400 dark:border-slate-500 rounded-br-sm pointer-events-none" />
        </div>
      </>)}
    </div>
  )
}
