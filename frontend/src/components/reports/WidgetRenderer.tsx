import type { RenderedWidget, ChartLayerItem, WidgetData } from '@/types'
import MultiLayerChart from '@/components/charts/MultiLayerChart'
import TableWidget from '@/components/charts/TableWidget'
import KpiCard from '@/components/charts/KpiCard'
import { AlertTriangle } from 'lucide-react'

interface Props {
  widget: RenderedWidget
  layers?: ChartLayerItem[]
  layerData?: Record<number, WidgetData>
  onChartClick?: (data: Record<string, unknown>) => void
  highlightField?: string
  highlightValue?: unknown
  drillActions?: any[]
  onDrillDown?: (data: Record<string, unknown>) => void
}

export default function WidgetRenderer({
  widget, layers = [], layerData = {},
  onChartClick, highlightField, highlightValue
}: Props) {
  if (widget.error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-500 dark:text-red-400 text-sm">
        <AlertTriangle className="w-6 h-6 mb-2" />
        <p>{widget.error}</p>
      </div>
    )
  }

  if (!widget.data) {
    if (widget.widgetType === 'TEXT') {
      return (
        <div className="h-full flex items-center p-4">
          <div className="prose dark:prose-invert text-sm"
               dangerouslySetInnerHTML={{ __html: widget.title || '' }} />
        </div>
      )
    }
    if (widget.widgetType === 'IMAGE') {
      const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
      return (
        <div className="h-full flex items-center justify-center p-2">
          <img src={config.src || ''} alt={widget.title || ''} className="max-w-full max-h-full object-contain" />
        </div>
      )
    }
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data</div>
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