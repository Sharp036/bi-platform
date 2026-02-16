import ReactECharts from 'echarts-for-react'
import type { WidgetData } from '@/types'
import { useThemeStore } from '@/store/themeStore'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

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

function buildValueFormatter(format: string, currency: string): ((value: number) => string) | undefined {
  switch (format) {
    case 'thousands': return (v: number) => (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K'
    case 'millions': return (v: number) => (v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M'
    case 'billions': return (v: number) => (v / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'B'
    case 'currency': return (v: number) => v.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 })
    case 'percent': return (v: number) => (v * 100).toFixed(1) + '%'
    default: return undefined
  }
}

function buildLabelFormatter(
  mode: string, count: number, total: number,
  values: number[], valueFmt?: (v: number) => string
): (p: { dataIndex: number; value: number }) => string {
  const isVisible = buildLabelVisibility(mode, count, total, values)
  return (p: { dataIndex: number; value: number }) => {
    const { dataIndex, value } = p
    if (!isVisible(dataIndex)) return ''
    return valueFmt ? valueFmt(value) : String(value)
  }
}

function buildLabelVisibility(
  mode: string, count: number, total: number, values: number[],
): (dataIndex: number) => boolean {
  let minIdx = -1, maxIdx = -1
  if (mode === 'min_max' && values.length > 0) {
    let minVal = Infinity, maxVal = -Infinity
    values.forEach((v, i) => {
      if (v < minVal) { minVal = v; minIdx = i }
      if (v > maxVal) { maxVal = v; maxIdx = i }
    })
  }
  return (dataIndex: number) => {
    if (mode === 'first' && dataIndex >= count) return false
    if (mode === 'last' && dataIndex < total - count) return false
    if (mode === 'min_max' && dataIndex !== minIdx && dataIndex !== maxIdx) return false
    return true
  }
}

function calcLinearRegression(values: number[]): number[] {
  const n = values.length
  if (n <= 1) return [...values]
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    const x = i
    const y = Number(values[i] ?? 0)
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }
  const denom = (n * sumXX) - (sumX * sumX)
  const slope = denom === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denom
  const intercept = (sumY - slope * sumX) / n
  return values.map((_, i) => slope * i + intercept)
}

function buildSmartLabelLayout(
  visibleIndices: number[],
  mode: string,
  staggerCount: number,
  totalPoints: number,
  seriesIndex: number,
  totalSeries: number,
  seriesColor?: string
) {
  const rowSpacing = 18
  const baseY = 8
  const visibleOrder = new Map<number, number>()
  visibleIndices.forEach((idx, order) => visibleOrder.set(idx, order))
  const useSidePacking = mode === 'last' || mode === 'first' || mode === 'min_max'

  return (params: { rect?: { x: number; y: number; width: number }; labelRect?: { width: number; height: number }; dataIndex: number }) => {
    const { rect, labelRect, dataIndex } = params
    if (!rect || !labelRect || labelRect.width < 1) return {}
    const order = visibleOrder.get(dataIndex) ?? dataIndex
    const compositeOrder = order * Math.max(1, totalSeries) + Math.max(0, seriesIndex)
    const row = compositeOrder % staggerCount
    const y = baseY + row * rowSpacing
    const anchorX = rect.x + rect.width / 2

    // For selective modes, move callouts gradually from chart edge to reduce overlap.
    if (useSidePacking) {
      const dayRankFromRight = Math.max(0, (totalPoints - 1) - dataIndex)
      const dayRankFromLeft = Math.max(0, dataIndex)
      const dayStep = 22
      const seriesStep = 8
      const side =
        mode === 'last' ? -1 :
          mode === 'first' ? 1 :
            (dataIndex > totalPoints / 2 ? -1 : 1)
      const edgeShift =
        mode === 'last' ? dayRankFromRight * dayStep :
          mode === 'first' ? dayRankFromLeft * dayStep :
            Math.floor(compositeOrder / staggerCount) * dayStep
      const x = anchorX + side * (edgeShift + (Math.max(0, seriesIndex) * seriesStep))
      return {
        x,
        y,
        align: side > 0 ? 'left' : 'right',
        verticalAlign: 'top',
        labelLinePoints: [
          [x, y + (labelRect.height || 12)],
          [anchorX + side * 10, y + (labelRect.height || 12)],
          [anchorX, rect.y],
        ],
        labelLineStyle: { color: seriesColor || '#bbb', width: 1.5, opacity: 0.95 },
      }
    }

    return {
      x: anchorX,
      y,
      align: 'center',
      verticalAlign: 'top',
      labelLinePoints: [
        [anchorX, y + (labelRect.height || 12)],
        [anchorX, rect.y],
      ],
      labelLineStyle: { color: seriesColor || '#bbb', width: 1.5, opacity: 0.95 },
    }
  }
}

function buildOption(data: WidgetData, config: Record<string, unknown>, regressionLabel: string) {
  const chartType = (config.type as string) || 'bar'
  const cols = data.columns || []
  const rows = data.rows || []

  // Use configured fields or fall back to defaults
  const categoryCol = (config.categoryField as string) || cols[0]
  const configuredValues = config.valueFields as string[] | undefined
  const seriesCols = Array.isArray(configuredValues)
    ? configuredValues.filter(f => cols.includes(f))
    : cols.filter(c => c !== categoryCol)

  // Display options
  const yAxisFormat = (config.yAxisFormat as string) || 'plain'
  const yAxisCurrency = (config.yAxisCurrency as string) || 'USD'
  const xAxisRotation = Number(config.xAxisRotation) || 0
  const showDataLabels = !!config.showDataLabels
  const dataLabelMode = (config.dataLabelMode as string) || 'all'
  const dataLabelCount = Number(config.dataLabelCount) || 3
  const dataLabelLevels = Math.max(1, Number(config.dataLabelLevels) || 3)
  const dataLabelRotation = Number(config.dataLabelRotation) || 0
  const regressionFields = Array.isArray(config.regressionFields) ? (config.regressionFields as string[]) : []
  const valueFormatter = buildValueFormatter(yAxisFormat, yAxisCurrency)
  const palette = Array.isArray((config.option as Record<string, unknown> | undefined)?.color)
    ? ((config.option as Record<string, unknown>).color as string[])
    : ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']

  const categories = rows.map(r => String(r[categoryCol] ?? ''))
  const series: any[] = seriesCols.map((col, seriesIndex) => {
    const seriesColor = palette[seriesIndex % palette.length]
    const colValues = rows.map(r => Number(r[col] ?? 0))
    const isLabelVisible = buildLabelVisibility(dataLabelMode, dataLabelCount, rows.length, colValues)
    const visibleLabelIndices = rows
      .map((_, idx) => idx)
      .filter(idx => isLabelVisible(idx))
    return {
      name: col,
      type: chartType,
      data: rows.map((r, dataIndex) => {
        const rawValue = r[col] ?? 0
        if (!showDataLabels || chartType === 'pie' || isLabelVisible(dataIndex)) return rawValue
        return {
          value: rawValue,
          label: { show: false },
          labelLine: { show: false },
        }
      }),
      smooth: chartType === 'line',
      ...(chartType === 'pie' ? {
        data: rows.map(r => ({ name: String(r[categoryCol] ?? ''), value: r[col] ?? 0 })),
      } : {}),
      ...(chartType !== 'pie' ? {
        itemStyle: { color: seriesColor },
        lineStyle: { color: seriesColor },
      } : {}),
      z: chartType === 'pie' ? undefined : 12,
      ...(showDataLabels ? {
        label: {
          show: true,
          position: chartType === 'pie' ? 'outside' : 'top',
          distance: 8,
          rotate: chartType === 'pie' ? undefined : (dataLabelRotation || undefined),
          fontSize: 10,
          formatter: chartType === 'pie'
            ? undefined
            : buildLabelFormatter(dataLabelMode, dataLabelCount, rows.length, colValues, valueFormatter),
        },
        ...(chartType !== 'pie' ? {
          labelLine: { show: true, lineStyle: { color: seriesColor, width: 1.5, opacity: 0.95 } },
        } : {}),
        ...(chartType !== 'pie' ? {
          labelLayout: buildSmartLabelLayout(
            visibleLabelIndices,
            dataLabelMode,
            dataLabelLevels,
            rows.length,
            seriesIndex,
            seriesCols.length,
            seriesColor
          ),
        } : {}),
      } : {}),
    }
  })

  if (chartType !== 'pie' && regressionFields.length > 0) {
    seriesCols.forEach(col => {
      if (!regressionFields.includes(col)) return
      const colValues = rows.map(r => Number(r[col] ?? 0))
      const trend = calcLinearRegression(colValues)
      const seriesColor = palette[seriesCols.indexOf(col) % palette.length]
      series.push({
        name: `${regressionLabel} (${col})`,
        type: 'line',
        data: trend,
        symbol: 'none',
        smooth: false,
        lineStyle: { type: 'dashed', width: 2, opacity: 0.95, color: seriesColor },
        emphasis: { disabled: true },
        silent: true,
        z: 20,
      })
    })
  }

  const hasAxis = !['pie', 'radar', 'funnel', 'gauge', 'treemap', 'sankey'].includes(chartType)

  // Count how many labels will be visible for stagger row calculation
  const visibleLabelCount = dataLabelMode === 'all' ? rows.length
    : dataLabelMode === 'min_max' ? 2
    : Math.min(dataLabelCount, rows.length)
  const staggerRows = Math.max(1, dataLabelLevels)

  return {
    tooltip: {
      trigger: chartType === 'pie' ? 'item' : 'axis',
      ...(hasAxis && valueFormatter ? {
        valueFormatter: (v: number) => valueFormatter(v),
      } : {}),
    },
    legend: seriesCols.length > 1 ? { bottom: 0 } : undefined,
    grid: {
      left: '3%', right: '4%',
      top: showDataLabels && hasAxis ? (baseTopPx(staggerRows)) : undefined,
      bottom: seriesCols.length > 1 ? '15%' : '3%',
      containLabel: true,
    },
    ...(hasAxis ? {
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: xAxisRotation ? { rotate: xAxisRotation } : undefined,
      },
      yAxis: {
        type: 'value',
        axisLabel: valueFormatter ? { formatter: valueFormatter } : undefined,
      },
    } : {}),
    series,
    ...(showDataLabels && hasAxis && dataLabelMode === 'all' ? {
      labelLayout: { moveOverlap: 'shiftY' },
    } : {}),
    ...config.option as object || {},
  }
}

function baseTopPx(staggerRows: number): number {
  return 8 + staggerRows * 16 + 10
}

export default function EChartWidget({ data, chartConfig, title, onChartClick, clickable }: Props) {
  const isDark = useThemeStore(s => s.isDark)
  const { t } = useTranslation()
  const config = parseConfig(chartConfig)
  const option = buildOption(data, config, t('designer.regression_lines'))
  const chartRef = useRef<ReactECharts>(null)

  const onEvents = onChartClick ? {
    click: (params: Record<string, unknown>) => {
      onChartClick(params)
    }
  } : undefined

  return (
    <div className="h-full flex flex-col">
      {title && <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">{title}</h3>}
      <div className={`flex-1 min-h-0 ${clickable ? 'cursor-pointer' : ''}`}>
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge={true}
          theme={isDark ? 'dark' : undefined}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents}
        />
      </div>
    </div>
  )
}
