import type { RenderedWidget } from '@/types'
import EChartWidget from '@/components/charts/EChartWidget'
import TableWidget from '@/components/charts/TableWidget'
import KpiCard from '@/components/charts/KpiCard'
import { AlertTriangle } from 'lucide-react'

interface Props { widget: RenderedWidget }

export default function WidgetRenderer({ widget }: Props) {
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

  switch (widget.widgetType) {
    case 'CHART':
      return <EChartWidget data={widget.data} chartConfig={widget.chartConfig} title={widget.title} />
    case 'TABLE':
      return <TableWidget data={widget.data} title={widget.title} />
    case 'KPI':
      return <KpiCard data={widget.data} title={widget.title} chartConfig={widget.chartConfig} />
    default:
      return <TableWidget data={widget.data} title={widget.title} />
  }
}
