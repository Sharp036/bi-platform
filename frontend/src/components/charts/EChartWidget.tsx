import ReactECharts from 'echarts-for-react'
import type { WidgetData } from '@/types'
import { useThemeStore } from '@/store/themeStore'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createCollisionFreeLayout, createInlineLabelLayout } from '@/components/charts/labelLayout'
import type { LabelPlacement } from '@/components/charts/labelLayout'

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

function defaultAxisDecimals(format: string): number {
  if (format === 'currency') return 0
  if (format === 'percent') return 1
  if (format === 'thousands' || format === 'millions' || format === 'billions') return 1
  return 0
}

function buildValueFormatter(format: string, currency: string, decimals?: number): ((value: number) => string) | undefined {
  const d = Math.max(0, Math.min(6, Number.isFinite(Number(decimals)) ? Number(decimals) : defaultAxisDecimals(format)))
  switch (format) {
    case 'thousands': return (v: number) => (v / 1000).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + 'K'
    case 'millions': return (v: number) => (v / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + 'M'
    case 'billions': return (v: number) => (v / 1_000_000_000).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + 'B'
    case 'currency': return (v: number) => v.toLocaleString(undefined, { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d })
    case 'percent': return (v: number) => (v * 100).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'
    case 'plain': return decimals != null
      ? (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
      : undefined
    default: return undefined
  }
}

function buildLegendOption(seriesCount: number, legendPosition: string, selectorLabels?: { all: string; inv: string }) {
  if (seriesCount <= 1 || legendPosition === 'hidden') return undefined
  const selector = selectorLabels ? [
    { type: 'all' as const, title: selectorLabels.all },
    { type: 'inverse' as const, title: selectorLabels.inv },
  ] : true
  const compact = {
    type: 'scroll' as const,
    selector,
    selectorLabel: { fontSize: 10, borderRadius: 2, padding: [2, 6] },
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


function estimateLegendHeight(seriesNames: string[], legendPosition: string): number {
  if (legendPosition !== 'bottom' && legendPosition !== 'auto') return 0
  const maxLines = seriesNames.reduce((m, name) => {
    const lines = wrapLegendText(name, 22, 3).split('\n').length
    return Math.max(m, lines)
  }, 1)
  const lineHeight = 12
  const legendLineBlock = Math.max(10, maxLines * lineHeight)
  return legendLineBlock + 14
}

function estimateDataLabelTopPadding(
  showDataLabels: boolean,
  hasAxis: boolean,
  totalRows: number,
  seriesCount: number,
  mode: string,
  count: number
): number {
  if (!showDataLabels || !hasAxis || totalRows <= 0 || seriesCount <= 0) return 0
  const visiblePerSeries =
    mode === 'all' ? totalRows
      : mode === 'min_max' ? Math.min(2, totalRows)
        : Math.min(Math.max(1, count || 1), totalRows)
  const totalVisible = Math.max(1, visiblePerSeries * seriesCount)
  // Conservative estimate: keep plot clear while collision layout still handles exact anti-overlap.
  const rows = Math.ceil(totalVisible / 4)
  const top = 18 + rows * 18
  return Math.max(52, Math.min(220, top))
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

function buildOption(
  data: WidgetData,
  config: Record<string, unknown>,
  regressionLabel: string,
  isDark: boolean,
  getChartWidth?: () => number,
  manualPositions?: Map<string, { x: number; y: number }>,
  placementsRef?: { current: Map<string, LabelPlacement> },
  selectorLabels?: { all: string; inv: string },
) {
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
  const yAxisMin = (config.yAxisMin as string) || 'zero'
  const yAxisFormat = (config.yAxisFormat as string) || 'plain'
  const yAxisCurrency = (config.yAxisCurrency as string) || 'USD'
  const yAxisDecimals = config.yAxisDecimals != null ? Number(config.yAxisDecimals) : undefined
  const xAxisRotation = Number(config.xAxisRotation) || 0
  const showDataLabels = !!config.showDataLabels
  const dataLabelMode = (config.dataLabelMode as string) || 'all'
  const dataLabelCount = Number(config.dataLabelCount) || 3
  const dataLabelPosition = (config.dataLabelPosition as string) || 'top'
  const isInlineLabels = dataLabelPosition === 'inline'
  const dataLabelTopSpacingMode = (config.dataLabelTopSpacingMode as string) || 'dynamic'
  const dataLabelSpread = !!config.dataLabelSpread
  const dataLabelRotation = Number(config.dataLabelRotation) || 0
  const dataLabelBoxed = !!config.dataLabelBoxed
  const dataLabelDecimals = config.dataLabelDecimals != null ? Number(config.dataLabelDecimals) : 1
  const dataLabelThousandsSep = config.dataLabelThousandsSep !== false
  const nullHandling = (config.nullHandling as string) || 'zero'
  const regressionFields = Array.isArray(config.regressionFields) ? (config.regressionFields as string[]) : []
  const legendPosition = (config.legendPosition as string) || 'auto'
  const valueFormatter = buildValueFormatter(yAxisFormat, yAxisCurrency, yAxisDecimals)
  const palette = Array.isArray((config.option as Record<string, unknown> | undefined)?.color)
    ? ((config.option as Record<string, unknown>).color as string[])
    : ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']

  const labelBg = isDark ? 'rgba(30,30,46,0.85)' : 'rgba(255,255,255,0.85)'

  const categories = rows.map(r => String(r[categoryCol] ?? ''))
  const series: any[] = seriesCols.map((col, seriesIndex) => {
    const seriesColor = palette[seriesIndex % palette.length]
    const colValues = rows.map(r => {
      const v = r[col]
      if (v == null || v === '') return nullHandling === 'gap' ? null : 0
      return Number(v) || 0
    })
    const isLabelVisible = buildLabelVisibility(dataLabelMode, dataLabelCount, rows.length, colValues.map(v => v ?? 0))
    return {
      name: col,
      type: chartType,
      connectNulls: false,
      data: rows.map((r, dataIndex) => {
        const v = r[col]
        const rawValue = (v == null || v === '') ? (nullHandling === 'gap' ? '-' : 0) : (Number(v) || 0)
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
          distance: isInlineLabels ? 6 : 8,
          rotate: chartType === 'pie' ? undefined : (dataLabelRotation || undefined),
          fontSize: 10,
          formatter: chartType === 'pie'
            ? undefined
            : buildLabelFormatter(dataLabelMode, dataLabelCount, rows.length, colValues.map(v => v ?? 0), dataLabelDecimals, dataLabelThousandsSep, valueFormatter),
          ...(dataLabelBoxed && chartType !== 'pie' ? {
            borderColor: seriesColor,
            borderWidth: 1,
            borderRadius: 3,
            padding: [2, 6],
            backgroundColor: labelBg,
          } : {}),
        },
        ...(chartType !== 'pie' && !isInlineLabels ? {
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
  const legend = buildLegendOption(series.length, legendPosition, selectorLabels)
  const showLegend = !!legend
  const legendIsTop = showLegend && legendPosition === 'top'
  const legendIsBottom = showLegend && (legendPosition === 'bottom' || legendPosition === 'auto')
  const legendIsLeft = showLegend && legendPosition === 'left'
  const legendIsRight = showLegend && legendPosition === 'right'
  const legendSidePad = (legendIsLeft || legendIsRight) ? 170 : 0
  const dynamicLabelTopPad = estimateDataLabelTopPadding(
    showDataLabels,
    hasAxis,
    rows.length,
    seriesCols.length,
    dataLabelMode,
    dataLabelCount
  )
  const fixedLabelTopPad = showDataLabels && hasAxis ? 120 : 0
  const inlineLabelTopPad = showDataLabels && hasAxis ? 24 : 0
  const labelTopPad = isInlineLabels ? inlineLabelTopPad
    : dataLabelTopSpacingMode === 'fixed' ? fixedLabelTopPad : dynamicLabelTopPad
  const legendHeight = showLegend ? estimateLegendHeight(series.map(s => String(s.name ?? '')), legendPosition) : 0
  // containLabel: true already accounts for x-axis label height, so gridBottom
  // only needs space for the legend (when at bottom) plus a small gap.
  const gridBottom = hasAxis
    ? Math.max(24, legendIsBottom ? legendHeight + 8 : 6)
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
      top: hasAxis
        ? (legendIsTop ? Math.max(56, labelTopPad + 42) : (labelTopPad || undefined))
        : undefined,
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
        min: yAxisMin === 'auto' ? 'dataMin' : 0,
        axisLabel: valueFormatter ? { formatter: valueFormatter } : undefined,
      },
    } : {}),
    series,
    ...(showDataLabels && hasAxis ? {
      labelLayout: isInlineLabels
        ? createInlineLabelLayout(getChartWidth, () => labelTopPad || 8)
        : createCollisionFreeLayout(getChartWidth, manualPositions, placementsRef, dataLabelSpread),
    } : {}),
  }

  const merged = {
    ...base,
    ...config.option as object || {},
  }
  return ensureXAxisLabelsVisible(merged)
}

interface DragState {
  key: string
  startMouseX: number
  startMouseY: number
  startLabelX: number
  startLabelY: number
}

export default function EChartWidget({ data, chartConfig, title, onChartClick, clickable }: Props) {
  const isDark = useThemeStore(s => s.isDark)
  const { t } = useTranslation()
  const config = parseConfig(chartConfig)

  const chartRef = useRef<ReactECharts>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const manualLabelPositions = useRef(new Map<string, { x: number; y: number }>())
  const labelPlacements = useRef(new Map<string, LabelPlacement>())
  const dragState = useRef<DragState | null>(null)

  const [, forceUpdate] = useState(0)
  const [dragging, setDragging] = useState<{ containerX: number; containerY: number } | null>(null)

  const getChartWidth = () => chartRef.current?.getEchartsInstance()?.getWidth() ?? 0

  const option = buildOption(
    data, config, t('charts.regression_short', 'Linear'), isDark,
    getChartWidth, manualLabelPositions.current, labelPlacements,
    { all: t('charts.legend_all', 'All'), inv: t('charts.legend_inv', 'Inv') },
  )

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const HIT_PAD = 6
    for (const [key, p] of labelPlacements.current) {
      if (cx >= p.x1 - HIT_PAD && cx <= p.x2 + HIT_PAD &&
          cy >= p.y1 - HIT_PAD && cy <= p.y2 + HIT_PAD) {
        e.preventDefault()
        e.stopPropagation()
        dragState.current = {
          key,
          startMouseX: cx,
          startMouseY: cy,
          startLabelX: (p.x1 + p.x2) / 2,
          startLabelY: p.y1,
        }
        setDragging({ containerX: cx, containerY: cy })
        return
      }
    }
  }, [])

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    for (const [key, p] of labelPlacements.current) {
      if (cx >= p.x1 && cx <= p.x2 && cy >= p.y1 && cy <= p.y2) {
        manualLabelPositions.current.delete(key)
        forceUpdate(n => n + 1)
        return
      }
    }
  }, [])

  const getCanvas = () =>
    containerRef.current?.querySelector('canvas') as HTMLElement | null

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    if (dragState.current) {
      const rect = container.getBoundingClientRect()
      setDragging({ containerX: e.clientX - rect.left, containerY: e.clientY - rect.top })
      return
    }
    // Update cursor on the canvas element so it overrides ECharts default
    const rect = container.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const HIT_PAD = 6
    const canvas = getCanvas()
    for (const p of labelPlacements.current.values()) {
      if (cx >= p.x1 - HIT_PAD && cx <= p.x2 + HIT_PAD &&
          cy >= p.y1 - HIT_PAD && cy <= p.y2 + HIT_PAD) {
        if (canvas) canvas.style.cursor = 'grab'
        return
      }
    }
    if (canvas) canvas.style.cursor = clickable ? 'pointer' : ''
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return
      // Keep grabbing cursor on canvas during drag (ECharts resets it on mousemove)
      const canvas = getCanvas()
      if (canvas) canvas.style.cursor = 'grabbing'
    }
    const onUp = (e: MouseEvent) => {
      if (!dragState.current) return
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        const { startMouseX, startMouseY, startLabelX, startLabelY, key } = dragState.current
        manualLabelPositions.current.set(key, {
          x: startLabelX + (cx - startMouseX),
          y: startLabelY + (cy - startMouseY),
        })
        forceUpdate(n => n + 1)
      }
      const canvas = getCanvas()
      if (canvas) canvas.style.cursor = ''
      dragState.current = null
      setDragging(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ── Events ────────────────────────────────────────────────────────────────

  const onEvents = onChartClick ? {
    click: (params: Record<string, unknown>) => {
      if (!dragState.current) onChartClick(params)
    },
  } : undefined

  const isDraggingNow = !!dragState.current

  return (
    <div className="h-full flex flex-col">
      {title && <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">{title}</h3>}
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 relative select-none${isDraggingNow ? ' cursor-grabbing' : (clickable ? ' cursor-pointer' : '')}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
      >
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge={true}
          theme={isDark ? 'dark' : undefined}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents}
        />
        {isDraggingNow && dragging && (
          <div
            style={{
              position: 'absolute',
              left: dragging.containerX,
              top: dragging.containerY,
              transform: 'translate(-50%, -120%)',
              pointerEvents: 'none',
              background: isDark ? 'rgba(30,30,46,0.92)' : 'rgba(255,255,255,0.92)',
              border: `1px dashed ${isDark ? '#888' : '#aaa'}`,
              borderRadius: 3,
              padding: '1px 8px',
              fontSize: 10,
              color: isDark ? '#ccc' : '#444',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            ↕ перетащить
          </div>
        )}
      </div>
    </div>
  )
}
