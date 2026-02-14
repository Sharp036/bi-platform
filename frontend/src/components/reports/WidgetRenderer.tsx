import type { RenderedWidget, ChartLayerItem, WidgetData } from '@/types'
import { useTranslation } from 'react-i18next'
import MultiLayerChart from '@/components/charts/MultiLayerChart'
import TableWidget from '@/components/charts/TableWidget'
import KpiCard from '@/components/charts/KpiCard'
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
}

export default function WidgetRenderer({
  widget, layers = [], layerData = {},
  onChartClick, highlightField, highlightValue,
  drillActions, onDrillDown,
  reportId, onToggleWidgets, onApplyFilter,
  annotations, tooltipConfig
}: Props) {
  const { t } = useTranslation()
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
    return <WebPageWidget url={config.url || ''} title={widget.title} />
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

  if (!widget.data) {
    if (widget.widgetType === 'TEXT') {
      const styleConfig = widget.style ? JSON.parse(widget.style) : {}
      return <RichTextWidget content={widget.title || ''} style={styleConfig} />
    }
    if (widget.widgetType === 'IMAGE') {
      const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
      return <ImageWidget src={config.src || ''} alt={widget.title} linkUrl={config.linkUrl} fit={config.fit} borderRadius={config.borderRadius} />
    }
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">{t('common.no_data')}</div>
  }

  switch (widget.widgetType) {
    case 'CHART':
      return (
        <MultiLayerChart
          data={widget.data}
          chartConfig={widget.chartConfig}
          title={widget.title}
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
      return <TableWidget data={widget.data} title={widget.title} />
    case 'KPI':
      return <KpiCard data={widget.data} title={widget.title} chartConfig={widget.chartConfig} />
    default:
      return <TableWidget data={widget.data} title={widget.title} />
  }
}