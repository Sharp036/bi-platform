import { useCallback, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { WidgetData, ChartLayerItem } from '@/types'
import { useThemeStore } from '@/store/themeStore'
import LayerTogglePanel from '@/components/interactive/LayerTogglePanel'
import { mergeAnnotationsIntoOption } from '@/components/charts/buildAnnotationOptions'
import { buildRichTooltip } from '@/components/charts/buildRichTooltip'
import type { AnnotationItem, TooltipConfigItem } from '@/api/visualization'
import { isCustomChartType, buildCustomChart } from '@/components/charts/chartTypeBuilders'
import { useTranslation } from 'react-i18next'

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

function formatLabelValue(v: number, decimals: number, thousandsSep: boolean): string {
  if (thousandsSep) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  return v.toFixed(decimals)
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
    if (valueFmt) return valueFmt(value)
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

interface Props {
  data: WidgetData
  chartConfig?: string
  title?: string
  layers?: ChartLayerItem[]
  layerData?: Record<number, WidgetData>  // layerId → data
  onChartClick?: (data: Record<string, unknown>) => void
  highlightField?: string
  highlightValue?: unknown
  annotations?: AnnotationItem[]
  tooltipConfig?: TooltipConfigItem
}

/**
 * Creates a top-level labelLayout function that prevents label overlap
 * using greedy rectangle-packing. All series share the same `placed` array
 * so cross-series collision is handled.
 */
function createCollisionFreeLayout() {
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

    for (let row = 0; row < 20; row++) {
      const baseY = 8 + row * ROW_H
      const offsets = [0]
      for (let i = 1; i <= 6; i++) {
        offsets.push(-(lw * 0.5 + GAP) * i)
        offsets.push((lw * 0.5 + GAP) * i)
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

    const y = 8 + placed.length * ROW_H
    placed.push({ x1: anchorX - lw / 2, y1: y, x2: anchorX + lw / 2, y2: y + lh })
    return {
      x: anchorX,
      y,
      align: 'center' as const,
      verticalAlign: 'top' as const,
      labelLinePoints: [
        [anchorX, y + lh],
        [anchorX, anchorY],
      ],
    }
  }
}

function parseConfig(raw?: string): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

export default function MultiLayerChart({
  data, chartConfig, title, layers = [], layerData = {},
  onChartClick, highlightField, highlightValue,
  annotations, tooltipConfig
}: Props) {
  const isDark = useThemeStore(s => s.isDark)
  const { t } = useTranslation()
  const config = parseConfig(chartConfig)

  // Local visibility state (overrides layer.isVisible for toggling without API call)
  const [visibilityMap, setVisibilityMap] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {}
    layers.forEach(l => { map[l.id] = l.isVisible })
    return map
  })

  const handleToggle = useCallback((layerId: number, visible: boolean) => {
    setVisibilityMap(prev => ({ ...prev, [layerId]: visible }))
  }, [])

  const layersWithVisibility = useMemo(() =>
    layers.map(l => ({ ...l, isVisible: visibilityMap[l.id] ?? l.isVisible })),
    [layers, visibilityMap]
  )

  const option = useMemo(() => {
    const chartType = (config.type as string) || 'bar'
    // Custom chart types (radar, heatmap, treemap, funnel, gauge, sankey, etc.)
    if (isCustomChartType(chartType)) {
      const custom = buildCustomChart(chartType, data, config as Record<string, any>)
      if (custom) {
        const tooltipOpts = tooltipConfig
          ? buildRichTooltip(tooltipConfig)
          : (custom.tooltip ? { tooltip: custom.tooltip } : { tooltip: { trigger: 'item', confine: true } })

        let result: any = {
          ...tooltipOpts,
          legend: custom.series.length > 1 ? { bottom: 0, type: 'scroll' } : undefined,
          ...custom,
          ...((config.option as object) || {}),
        }

        if (annotations && annotations.length > 0) {
          result = mergeAnnotationsIntoOption(result, annotations)
        }

        return result
      }
    }

    const cols = data.columns || []
    const rows = data.rows || []

    // Use configured fields or fall back to defaults (match EChartWidget behavior)
    const categoryCol = (config.categoryField as string) || cols[0]
    const categories = rows.map(r => String(r[categoryCol] ?? ''))

    // Determine if we need dual axis
    const hasRightAxis = layersWithVisibility.some(l => l.axis === 'right' && l.isVisible)

    // Build base series from widget data (if no layers, use old logic)
    const series: any[] = []

    // Display options from chartConfig (match EChartWidget behavior)
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
    const valueFormatter = buildValueFormatter(yAxisFormat, yAxisCurrency)
    const regressionLabel = t('designer.regression_lines')
    const palette = Array.isArray((config.option as Record<string, unknown> | undefined)?.color)
      ? ((config.option as Record<string, unknown>).color as string[])
      : ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']

    const labelBg = isDark ? 'rgba(30,30,46,0.85)' : 'rgba(255,255,255,0.85)'

    if (layersWithVisibility.length === 0) {
      // Use configured valueFields or fall back to all non-category columns
      const configuredValues = config.valueFields as string[] | undefined
      const seriesCols = Array.isArray(configuredValues)
        ? configuredValues.filter(f => cols.includes(f))
        : cols.filter(c => c !== categoryCol)
      seriesCols.forEach((col, seriesIndex) => {
        const seriesColor = palette[seriesIndex % palette.length]
        const colValues = rows.map(r => Number(r[col] ?? 0))
        const isLabelVisible = buildLabelVisibility(dataLabelMode, dataLabelCount, rows.length, colValues)
        if (chartType === 'pie') {
          series.push({
            name: col, type: 'pie', radius: ['40%', '70%'],
            data: rows.map(r => ({ name: String(r[categoryCol] ?? ''), value: r[col] ?? 0 })),
          })
        } else {
          series.push({
            name: col, type: chartType,
            data: rows.map((r, dataIndex) => {
              const rawValue = r[col] ?? 0
              if (!showDataLabels || isLabelVisible(dataIndex)) return rawValue
              return {
                value: rawValue,
                label: { show: false },
                labelLine: { show: false },
              }
            }),
            smooth: chartType === 'line',
            itemStyle: { color: seriesColor },
            lineStyle: { color: seriesColor },
            z: 12,
            ...(showDataLabels ? {
              label: {
                show: true, position: 'top', distance: 8,
                rotate: dataLabelRotation || undefined,
                fontSize: 10,
                formatter: buildLabelFormatter(dataLabelMode, dataLabelCount, rows.length, colValues, dataLabelDecimals, dataLabelThousandsSep, valueFormatter),
                ...(dataLabelBoxed ? {
                  borderColor: seriesColor,
                  borderWidth: 1,
                  borderRadius: 3,
                  padding: [2, 6],
                  backgroundColor: labelBg,
                } : {}),
              },
              labelLine: { show: true, lineStyle: { color: seriesColor, width: 1.5, opacity: 0.95 } },
            } : {}),
          })
        }
      })
      if (chartType !== 'pie' && regressionFields.length > 0) {
        seriesCols.forEach(col => {
          if (!regressionFields.includes(col)) return
          const seriesColor = palette[seriesCols.indexOf(col) % palette.length]
          series.push({
            name: `${regressionLabel} (${col})`,
            type: 'line',
            data: calcLinearRegression(rows.map(r => Number(r[col] ?? 0))),
            symbol: 'none',
            smooth: false,
            lineStyle: { type: 'dashed', width: 2, opacity: 0.95, color: seriesColor },
            emphasis: { disabled: true },
            silent: true,
            z: 20,
          })
        })
      }
    } else {
      // Layer-based series
      layersWithVisibility.forEach((layer) => {
        if (!layer.isVisible) return

        // Use layer-specific data if available, otherwise fall back to widget data
        const lData = layerData[layer.id] || data
        const lRows = lData.rows || []
        const catField = layer.categoryField || categoryCol
        const valField = layer.valueField || (lData.columns?.[1])

        // Parse seriesConfig overrides
        let seriesOverrides: Record<string, any> = {}
        if (layer.seriesConfig && typeof layer.seriesConfig === 'object') {
          seriesOverrides = layer.seriesConfig as Record<string, any>
        }

        const s: any = {
          name: layer.label || layer.name,
          type: layer.chartType || chartType,
          data: lRows.map(r => r[valField || ''] ?? 0),
          smooth: layer.chartType === 'line',
          yAxisIndex: layer.axis === 'right' ? 1 : 0,
          ...seriesOverrides,
        }

        // Color
        if (layer.color) {
          s.itemStyle = { ...(s.itemStyle || {}), color: layer.color }
          s.lineStyle = { ...(s.lineStyle || {}), color: layer.color }
        }

        // Opacity
        if (layer.opacity < 1) {
          s.itemStyle = { ...(s.itemStyle || {}), opacity: layer.opacity }
          s.areaStyle = layer.chartType === 'area'
            ? { ...(s.areaStyle || {}), opacity: layer.opacity * 0.3 }
            : s.areaStyle
        }

        // Area chart = line with areaStyle
        if (layer.chartType === 'area') {
          s.type = 'line'
          s.areaStyle = s.areaStyle || { opacity: 0.3 }
        }

        series.push(s)
      })
      if (regressionFields.length > 0) {
        const baseSeries = series.filter(s => Array.isArray(s?.data))
        baseSeries.forEach((s: any) => {
          const seriesName = String(s.name || '')
          if (!regressionFields.includes(seriesName)) return
          const vals = (s.data as any[]).map(v => Number(typeof v === 'object' ? v?.value : v) || 0)
          series.push({
            name: `${regressionLabel} (${seriesName})`,
            type: 'line',
            data: calcLinearRegression(vals),
            symbol: 'none',
            smooth: false,
            yAxisIndex: s.yAxisIndex || 0,
            lineStyle: { type: 'dashed', width: 2, opacity: 0.95, color: s.lineStyle?.color || s.itemStyle?.color },
            emphasis: { disabled: true },
            silent: true,
            z: 20,
          })
        })
      }
    }

    // Build yAxis
    const yAxis: any[] = [{ type: 'value' }]
    if (hasRightAxis) {
      yAxis.push({ type: 'value', position: 'right', splitLine: { show: false } })
    }

    // Highlight
    let emphasisConfig: any = undefined
    if (highlightField && highlightValue !== undefined) {
      emphasisConfig = {
        emphasis: { focus: 'series' },
      }
    }

    const isPie = chartType === 'pie' || layersWithVisibility.some(l => l.chartType === 'pie')

    const tooltipOpts = tooltipConfig
      ? buildRichTooltip(tooltipConfig)
      : { tooltip: { trigger: isPie ? 'item' : 'axis', confine: true } }

    // Apply formatting to yAxis
    if (valueFormatter) {
      yAxis[0] = { ...yAxis[0], axisLabel: { formatter: valueFormatter } }
    }

    let result = {
      ...tooltipOpts,
      ...(valueFormatter && !isPie ? { tooltip: { ...((tooltipOpts as any).tooltip || {}), valueFormatter } } : {}),
      legend: series.length > 1 ? { bottom: 0, type: 'scroll' } : undefined,
      grid: {
        left: '3%',
        right: hasRightAxis ? '8%' : '4%',
        top: showDataLabels && !isPie ? 120 : undefined,
        bottom: series.length > 1 ? '15%' : '3%',
        containLabel: true,
      },
      ...(!isPie ? {
        xAxis: {
          type: 'category', data: categories,
          axisLabel: xAxisRotation ? { rotate: xAxisRotation } : undefined,
        },
        yAxis,
      } : {}),
      series,
      ...(showDataLabels && !isPie ? {
        labelLayout: createCollisionFreeLayout(),
      } : {}),
      ...(emphasisConfig || {}),
      ...((config.option as object) || {}),
    }

    if (annotations && annotations.length > 0) {
      result = mergeAnnotationsIntoOption(result, annotations)
    }

    return result
  }, [data, config, layersWithVisibility, layerData, highlightField, highlightValue, annotations, tooltipConfig, isDark])

  const handleClick = useCallback((params: any) => {
    if (!onChartClick) return
    const payload: Record<string, unknown> = {
      name: params.name,
      value: params.value,
      seriesName: params.seriesName,
      dataIndex: params.dataIndex,
    }
    // Add all data columns from the clicked row
    if (data.rows && params.dataIndex < data.rows.length) {
      const row = data.rows[params.dataIndex]
      for (const [k, v] of Object.entries(row)) {
        payload[k] = v
      }
    }
    onChartClick(payload)
  }, [onChartClick, data])

  const onEvents = useMemo(() => ({
    click: handleClick,
  }), [handleClick])

  return (
    <div className="h-full flex flex-col">
      {/* Header: title + layer toggles */}
      <div className="flex items-start justify-between mb-1 px-1">
        {title && (
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
            {title}
          </h3>
        )}
        {layersWithVisibility.length > 0 && (
          <LayerTogglePanel
            layers={layersWithVisibility}
            onToggle={handleToggle}
            compact
          />
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ReactECharts
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
