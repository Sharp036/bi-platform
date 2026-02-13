import ReactECharts from 'echarts-for-react'
import type { WidgetData } from '@/types'
import { useThemeStore } from '@/store/themeStore'
import { useRef, useCallback } from 'react'

interface Props {
  data: WidgetData
  chartConfig?: string
  title?: string
  onChartClick?: (params: Record<string, unknown>) => void
  clickable?: boolean
}

function parseConfig(raw?: string): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function buildOption(data: WidgetData, config: Record<string, unknown>) {
  const chartType = (config.type as string) || 'bar'
  const cols = data.columns || []
  const rows = data.rows || []

  // Default: first column = category, rest = series
  const categoryCol = cols[0]
  const seriesCols = cols.slice(1)

  const categories = rows.map(r => String(r[categoryCol] ?? ''))
  const series = seriesCols.map(col => ({
    name: col,
    type: chartType,
    data: rows.map(r => r[col] ?? 0),
    smooth: chartType === 'line',
    ...(chartType === 'pie' ? {
      data: rows.map(r => ({ name: String(r[categoryCol] ?? ''), value: r[col] ?? 0 })),
    } : {}),
  }))

  return {
    tooltip: { trigger: chartType === 'pie' ? 'item' : 'axis' },
    legend: seriesCols.length > 1 ? { bottom: 0 } : undefined,
    grid: { left: '3%', right: '4%', bottom: seriesCols.length > 1 ? '15%' : '3%', containLabel: true },
    ...(chartType !== 'pie' ? {
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value' },
    } : {}),
    series,
    ...config.option as object || {},
  }
}

export default function EChartWidget({ data, chartConfig, title, onChartClick, clickable }: Props) {
  const isDark = useThemeStore(s => s.isDark)
  const config = parseConfig(chartConfig)
  const option = buildOption(data, config)
  const chartRef = useRef<ReactECharts>(null)

  const onEvents = useCallback(() => {
    if (!onChartClick) return {}
    return {
      click: (params: Record<string, unknown>) => {
        onChartClick(params)
      }
    }
  }, [onChartClick])

  return (
    <div className="h-full flex flex-col">
      {title && <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">{title}</h3>}
      <div className={`flex-1 min-h-0 ${clickable ? 'cursor-pointer' : ''}`}>
        <ReactECharts
          ref={chartRef}
          option={option}
          theme={isDark ? 'dark' : undefined}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents()}
        />
      </div>
    </div>
  )
}
