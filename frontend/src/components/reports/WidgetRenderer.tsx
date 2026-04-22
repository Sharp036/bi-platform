import type { RenderedWidget, ChartLayerItem, WidgetData } from '@/types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import MultiLayerChart from '@/components/charts/MultiLayerChart'
import TableWidget from '@/components/charts/TableWidget'
import KpiCard from '@/components/charts/KpiCard'
import FilterWidget from '@/components/charts/FilterWidget'
import { AlertTriangle } from 'lucide-react'
import ButtonWidget from '@/components/interactive/ButtonWidget'
import type { ButtonConfig } from '@/api/controls'
import { WebPageWidget, SpacerWidget, DividerWidget, RichTextWidget, ImageWidget } from '@/components/interactive/DashboardObjects'
import type { AnnotationItem, TooltipConfigItem } from '@/api/visualization'

interface Props {
  widget: RenderedWidget
  layers?: ChartLayerItem[]
  layerData?: Record<number, WidgetData>
  onChartClick?: (data: Record<string, unknown>) => void
  highlightField?: string
  highlightValue?: unknown
  drillActions?: any[]
  onDrillDown?: (data: Record<string, unknown>) => void
  reportId?: number
  onToggleWidgets?: (widgetIds: number[]) => void
  onApplyFilter?: (field: string, value: string) => void
  annotations?: AnnotationItem[]
  tooltipConfig?: TooltipConfigItem
  onWidgetDisplay?: (widgetId: number, state: { columns: string[]; rows: Record<string, unknown>[] }) => void
}

// Placeholder syntax: {columnName} or {columnName:format} inside title strings.
// Supported formats: int, fixed1, fixed2, fixed3, percent, percent0, percent1,
// thousands, millions. Values come from widget.data.rows[0].
const TITLE_PLACEHOLDER_RE = /\{([A-Za-zА-Яа-я0-9_\-.,% ]+?)(?::([a-zA-Z0-9]+))?\}/g

function formatTitleValue(value: unknown, format?: string): string {
  if (value == null) return '—'
  const num = Number(value)
  const hasNum = Number.isFinite(num)
  switch (format) {
    case 'int':      return hasNum ? Math.round(num).toLocaleString() : String(value)
    case 'fixed1':   return hasNum ? num.toFixed(1) : String(value)
    case 'fixed2':   return hasNum ? num.toFixed(2) : String(value)
    case 'fixed3':   return hasNum ? num.toFixed(3) : String(value)
    case 'percent':
    case 'percent1': return hasNum ? `${(num * 100).toFixed(1)}%` : String(value)
    case 'percent0': return hasNum ? `${Math.round(num * 100)}%` : String(value)
    case 'thousands':return hasNum ? `${(num / 1000).toFixed(1)}K` : String(value)
    case 'millions': return hasNum ? `${(num / 1_000_000).toFixed(2)} млн` : String(value)
    default:         return hasNum ? num.toLocaleString() : String(value)
  }
}

function interpolateTitle(title: string | undefined, data: WidgetData | undefined): string | undefined {
  if (!title || !title.includes('{')) return title
  if (!data || !data.rows || data.rows.length === 0) return title
  const row = data.rows[0]
  return title.replace(TITLE_PLACEHOLDER_RE, (match, col, format) => {
    const trimmed = String(col).trim()
    if (!(trimmed in row)) return match
    return formatTitleValue(row[trimmed], format)
  })
}

export default function WidgetRenderer({
  widget, layers = [], layerData = {},
  onChartClick, highlightField, highlightValue,
  drillActions, onDrillDown,
  reportId, onToggleWidgets, onApplyFilter,
  annotations, tooltipConfig,
  onWidgetDisplay,
}: Props) {
  const { t } = useTranslation()

  // Interpolate {columnName:format} placeholders in title using first data row.
  // Pure function of title + data so memoization is free.
  const resolvedTitle = useMemo(
    () => interpolateTitle(widget.title, widget.data),
    [widget.title, widget.data],
  )

  if (widget.error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-500 dark:text-red-400 text-sm">
        <AlertTriangle className="w-6 h-6 mb-2" />
        <p>{widget.error}</p>
      </div>
    )
  }

  if (widget.widgetType === 'BUTTON') {
    const btnConfig: ButtonConfig = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return (
      <ButtonWidget
        config={btnConfig}
        reportId={reportId || 0}
        onToggleWidgets={onToggleWidgets}
        onApplyFilter={onApplyFilter}
      />
    )
  }

  if (widget.widgetType === 'WEBPAGE') {
    const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return <WebPageWidget url={config.url || ''} title={resolvedTitle} />
  }

  if (widget.widgetType === 'SPACER') {
    const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return <SpacerWidget height={config.height} color={config.color} />
  }

  if (widget.widgetType === 'DIVIDER') {
    const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return <DividerWidget
      orientation={config.orientation}
      color={config.color}
      thickness={config.thickness}
      style={config.style}
      label={config.label}
    />
  }

  // TEXT widget: rendered whether or not a SQL query is attached. When data is
  // present, {column} placeholders in widget.title are interpolated from row[0].
  if (widget.widgetType === 'TEXT') {
    const styleConfig = widget.style ? JSON.parse(widget.style) : {}
    return <RichTextWidget content={widget.title || ''} style={styleConfig} data={widget.data} />
  }

  if (!widget.data) {
    if (widget.widgetType === 'IMAGE') {
      const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
      return <ImageWidget src={config.src || config.url || ''} alt={resolvedTitle} linkUrl={config.linkUrl} fit={config.fit} borderRadius={config.borderRadius} />
    }
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">{t('common.no_data')}</div>
  }

  switch (widget.widgetType) {
    case 'CHART':
      return (
        <MultiLayerChart
          data={widget.data}
          chartConfig={widget.chartConfig}
          title={resolvedTitle}
          layers={layers}
          layerData={layerData}
          onChartClick={(data) => {
            onChartClick?.(data)
            if (onDrillDown) onDrillDown(data)
          }}
          highlightField={highlightField}
          highlightValue={highlightValue}
          annotations={annotations}
          tooltipConfig={tooltipConfig}
        />
      )
    case 'TABLE':
      return (
        <TableWidget
          data={widget.data}
          title={resolvedTitle}
          chartConfig={widget.chartConfig}
          clickable={!!onChartClick}
          onRowClick={(row) => {
            onChartClick?.(row)
            if (onDrillDown) onDrillDown(row)
          }}
          onDisplayStateChange={onWidgetDisplay ? state => onWidgetDisplay(widget.widgetId, state) : undefined}
        />
      )
    case 'KPI':
      return <KpiCard data={widget.data} title={resolvedTitle} chartConfig={widget.chartConfig} />
    case 'FILTER':
      return <FilterWidget data={widget.data} chartConfig={widget.chartConfig} onApplyFilter={onApplyFilter} />
    default:
      return <TableWidget data={widget.data} title={resolvedTitle} chartConfig={widget.chartConfig} />
  }
}
