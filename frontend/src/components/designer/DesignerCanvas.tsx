import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import { useTranslation } from 'react-i18next'
import { BarChart3, Table, Hash, Type, Filter, ImageIcon, GripVertical, EyeOff } from 'lucide-react'
import clsx from 'clsx'

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
          {!widget.isVisible && <EyeOff className="w-3 h-3 text-slate-400" />}
        </div>

        {/* Body */}
        <div className="flex-1 flex items-center justify-center p-2 min-h-0">
          {widget.widgetType === 'TEXT' ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 overflow-hidden line-clamp-4 w-full"
                 dangerouslySetInnerHTML={{ __html: widget.title || '<p>Text content</p>' }} />
          ) : widget.widgetType === 'IMAGE' && (widget.chartConfig as Record<string, unknown>).url ? (
            <img
              src={(widget.chartConfig as Record<string, unknown>).url as string}
              alt={widget.title}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="text-center">
              <Icon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {widget.queryId ? `Query #${widget.queryId}` : widget.rawSql ? t('designer.inline_sql_badge') : t('designer.no_data_bound')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
