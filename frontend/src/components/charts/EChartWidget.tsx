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

function buildLegendOption(seriesCount: number, legendPosition: string) {
  if (seriesCount <= 1 || legendPosition === 'hidden') return undefined
  const compact = {
    type: 'scroll' as const,
    itemWidth: 12,
    itemHeight: 7,
    itemGap: 6,
    pageIconSize: 10,
    pageTextStyle: { fontSize: 10 },
    textStyle: {
      fontSize: 10,
      lineHeight: 12,
      width: 138,
      overflow: 'break' as const,
    },
    formatter: (name: string) => wrapLegendText(name, 22, 3),
  }
  if (legendPosition === 'top') return { ...compact, top: 0, left: 'center' as const }
  if (legendPosition === 'left') return { ...compact, left: 0, top: 'middle' as const, orient: 'vertical' as const, height: '78%' }
  if (legendPosition === 'right') return { ...compact, right: 0, top: 'middle' as const, orient: 'vertical' as const, height: '78%' }
  return { ...compact, bottom: 0, left: 'center' as const }
}

function wrapLegendText(value: string, lineLen: number, maxLines: number): string {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
      continue
    }
    if ((current + ' ' + word).length <= lineLen) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
      if (lines.length >= maxLines - 1) break
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  const hasMore = words.join(' ').length > lines.join(' ').length
  if (hasMore && lines.length > 0) lines[lines.length - 1] = `${lines[lines.length - 1]}…`
  return lines.join('\n')
}

function ensureXAxisLabelsVisible(option: any) {
  const ensureAxis = (axis: any) => {
    if (!axis || axis.type !== 'category') return axis
    const existing = axis.axisLabel || {}
    return {
      ...axis,
      axisLabel: {
        ...existing,
        show: true,
        hideOverlap: false,
      },
    }
  }
  if (Array.isArray(option?.xAxis)) {
    return { ...option, xAxis: option.xAxis.map(ensureAxis) }
  }
  if (option?.xAxis) {
    return { ...option, xAxis: ensureAxis(option.xAxis) }
  }
  return option
}

function formatLabelValue(v: unknown, decimals: number, thousandsSep: boolean): string {
  const num = Number(v)
  if (!Number.isFinite(num)) return String(v ?? '')
  if (thousandsSep) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  return num.toFixed(decimals)
}

function formatTooltipValue(
  raw: unknown,
  valueFmt: ((value: number) => string) | undefined,
  decimals: number,
  thousandsSep: boolean
): string {
  const num = Number(raw)
  if (!Number.isFinite(num)) return String(raw ?? '')
  if (valueFmt) return valueFmt(num)
  return formatLabelValue(num, decimals, thousandsSep)
}

function buildLabelFormatter(
  mode: string, count: number, total: number,
  values: number[], decimals: number, thousandsSep: boolean,
  valueFmt?: (v: number) => string
): (p: { dataIndex: number; value: number }) => string {
  const isVisible = buildLabelVisibility(mode, count, total, values)
  return (p: { dataIndex: number; value: number }) => {
    const { dataIndex, value } = p
    if (!isVisible(dataIndex)) return ''
    const num = Number(value)
    if (valueFmt && Number.isFinite(num)) return valueFmt(num)
    return formatLabelValue(value, decimals, thousandsSep)
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

/**
 * Creates a top-level labelLayout function that prevents label overlap
 * using greedy rectangle-packing. All series share the same `placed` array
 * so cross-series collision is handled.
 */
function createCollisionFreeLayout(getChartWidth?: () => number) {
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = []
  let lastTs = 0
  const GAP = 4

  function collides(r: { x1: number; y1: number; x2: number; y2: number }) {
    return placed.some(p =>
      r.x1 < p.x2 + GAP && r.x2 > p.x1 - GAP &&
      r.y1 < p.y2 + GAP && r.y2 > p.y1 - GAP
    )
  }

  return (params: {
    rect?: { x: number; y: number; width: number; height: number }
    labelRect?: { x: number; y: number; width: number; height: number }
    dataIndex: number
    seriesIndex: number
  }) => {
    // Reset placed array on a new layout pass (gap > 50ms between calls)
    const now = Date.now()
    if (now - lastTs > 50) placed.length = 0
    lastTs = now

    const { rect, labelRect } = params
    if (!rect || !labelRect || labelRect.width < 1) return {}

    const anchorX = rect.x + rect.width / 2
    const anchorY = rect.y
    const lw = labelRect.width
    const lh = labelRect.height
    const ROW_H = lh + GAP
    const chartW = getChartWidth?.() ?? 0

    // For labels near the right edge, try left offsets first; near the left — right first
    const preferLeft = chartW > 0 && anchorX > chartW * 0.6

    // Try rows from top of chart, with horizontal offsets for each row
    for (let row = 0; row < 20; row++) {
      const baseY = 8 + row * ROW_H
      const offsets = [0]
      for (let i = 1; i <= 6; i++) {
        if (preferLeft) {
          offsets.push(-(lw * 0.5 + GAP) * i)
          offsets.push((lw * 0.5 + GAP) * i)
        } else {
          offsets.push((lw * 0.5 + GAP) * i)
          offsets.push(-(lw * 0.5 + GAP) * i)
        }
      }
      for (const dx of offsets) {
        const cx = anchorX + dx
        const candidate = {
          x1: cx - lw / 2,
          y1: baseY,
          x2: cx + lw / 2,
          y2: baseY + lh,
        }
        if (candidate.x1 < 0) continue
        if (chartW > 0 && candidate.x2 > chartW) continue
        if (!collides(candidate)) {
          placed.push(candidate)
          return {
            x: cx,
            y: baseY,
            align: 'center' as const,
            verticalAlign: 'top' as const,
            labelLinePoints: [
              [cx, baseY + lh],
              [anchorX, anchorY],
            ],
          }
        }
      }
    }

    // Fallback — clamp within chart bounds
    const y = 8 + placed.length * ROW_H
    const clampedX = chartW > 0 ? Math.max(lw / 2, Math.min(anchorX, chartW - lw / 2)) : anchorX
    placed.push({ x1: clampedX - lw / 2, y1: y, x2: clampedX + lw / 2, y2: y + lh })
    return {
      x: clampedX,
      y,
      align: 'center' as const,
      verticalAlign: 'top' as const,
      labelLinePoints: [
        [clampedX, y + lh],
        [anchorX, anchorY],
      ],
    }
  }
}

function buildOption(data: WidgetData, config: Record<string, unknown>, regressionLabel: string, isDark: boolean, getChartWidth?: () => number) {
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
  const dataLabelRotation = Number(config.dataLabelRotation) || 0
  const dataLabelBoxed = !!config.dataLabelBoxed
  const dataLabelDecimals = config.dataLabelDecimals != null ? Number(config.dataLabelDecimals) : 1
  const dataLabelThousandsSep = config.dataLabelThousandsSep !== false
  const regressionFields = Array.isArray(config.regressionFields) ? (config.regressionFields as string[]) : []
  const legendPosition = (config.legendPosition as string) || 'auto'
  const valueFormatter = buildValueFormatter(yAxisFormat, yAxisCurrency)
  const palette = Array.isArray((config.option as Record<string, unknown> | undefined)?.color)
    ? ((config.option as Record<string, unknown>).color as string[])
    : ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']

  const labelBg = isDark ? 'rgba(30,30,46,0.85)' : 'rgba(255,255,255,0.85)'

  const categories = rows.map(r => String(r[categoryCol] ?? ''))
  const series: any[] = seriesCols.map((col, seriesIndex) => {
    const seriesColor = palette[seriesIndex % palette.length]
    const colValues = rows.map(r => Number(r[col] ?? 0))
    const isLabelVisible = buildLabelVisibility(dataLabelMode, dataLabelCount, rows.length, colValues)
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
            : buildLabelFormatter(dataLabelMode, dataLabelCount, rows.length, colValues, dataLabelDecimals, dataLabelThousandsSep, valueFormatter),
          ...(dataLabelBoxed && chartType !== 'pie' ? {
            borderColor: seriesColor,
            borderWidth: 1,
            borderRadius: 3,
            padding: [2, 6],
            backgroundColor: labelBg,
          } : {}),
        },
        ...(chartType !== 'pie' ? {
          labelLine: { show: true, lineStyle: { color: seriesColor, width: 1.5, opacity: 0.95 } },
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
  const legend = buildLegendOption(series.length, legendPosition)
  const showLegend = !!legend
  const legendIsTop = showLegend && legendPosition === 'top'
  const legendIsBottom = showLegend && (legendPosition === 'bottom' || legendPosition === 'auto')
  const legendIsLeft = showLegend && legendPosition === 'left'
  const legendIsRight = showLegend && legendPosition === 'right'
  const legendSidePad = (legendIsLeft || legendIsRight) ? 170 : 0
  const gridBottom = hasAxis
    ? (legendIsBottom ? (xAxisRotation ? 170 : 150) : (xAxisRotation ? 62 : 30))
    : 12

  const base = {
    tooltip: {
      trigger: chartType === 'pie' ? 'item' : 'axis',
      ...(hasAxis ? {
        valueFormatter: (v: unknown) => formatTooltipValue(v, valueFormatter, dataLabelDecimals, dataLabelThousandsSep),
      } : {}),
    },
    legend,
    grid: {
      left: legendIsLeft ? legendSidePad : '3%',
      right: legendIsRight ? legendSidePad : '4%',
      top: showDataLabels && hasAxis
        ? (legendIsTop ? 165 : 120)
        : (legendIsTop ? 56 : undefined),
      bottom: gridBottom,
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
    ...(showDataLabels && hasAxis ? {
      labelLayout: createCollisionFreeLayout(getChartWidth),
    } : {}),
  }

  const merged = {
    ...base,
    ...config.option as object || {},
  }
  return ensureXAxisLabelsVisible(merged)
}

export default function EChartWidget({ data, chartConfig, title, onChartClick, clickable }: Props) {
  const isDark = useThemeStore(s => s.isDark)
  const { t } = useTranslation()
  const config = parseConfig(chartConfig)
  const chartRef = useRef<ReactECharts>(null)
  const getChartWidth = () => chartRef.current?.getEchartsInstance()?.getWidth() ?? 0
  const option = buildOption(data, config, t('charts.regression_short', 'Linear'), isDark, getChartWidth)

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
