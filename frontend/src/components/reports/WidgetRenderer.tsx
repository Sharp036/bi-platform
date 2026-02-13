import type { RenderedWidget, DrillAction } from '@/types'
import EChartWidget from '@/components/charts/EChartWidget'
import TableWidget from '@/components/charts/TableWidget'
import KpiCard from '@/components/charts/KpiCard'
import { AlertTriangle } from 'lucide-react'

interface Props {
  widget: RenderedWidget
  drillActions?: DrillAction[]
  onDrillDown?: (clickedData: Record<string, unknown>) => void
}

export default function WidgetRenderer({ widget, drillActions, onDrillDown }: Props) {
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
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data</div>
  }

  const hasDrill = !!onDrillDown && drillActions && drillActions.length > 0

  // Table row click handler
  const handleRowClick = (row: Record<string, unknown>) => {
    if (onDrillDown) onDrillDown(row)
  }

  // Chart click handler
  const handleChartClick = (params: Record<string, unknown>) => {
    if (onDrillDown) {
      const clickedData: Record<string, unknown> = {
        name: params.name,
        value: params.value,
        seriesName: params.seriesName,
        dataIndex: params.dataIndex,
        ...((params.data && typeof params.data === 'object') ? params.data as Record<string, unknown> : {})
      }
      onDrillDown(clickedData)
    }
  }

  switch (widget.widgetType) {
    case 'CHART':
      return (
        <EChartWidget
          data={widget.data}
          chartConfig={widget.chartConfig}
          title={widget.title}
          onChartClick={hasDrill ? handleChartClick : undefined}
          clickable={hasDrill}
        />
      )
    case 'TABLE':
      return (
        <TableWidget
          data={widget.data}
          title={widget.title}
          onRowClick={hasDrill ? handleRowClick : undefined}
          clickable={hasDrill}
        />
      )
    case 'KPI':
      return <KpiCard data={widget.data} title={widget.title} chartConfig={widget.chartConfig} />
    default:
      return (
        <TableWidget
          data={widget.data}
          title={widget.title}
          onRowClick={hasDrill ? handleRowClick : undefined}
          clickable={hasDrill}
        />
      )
  }
}
