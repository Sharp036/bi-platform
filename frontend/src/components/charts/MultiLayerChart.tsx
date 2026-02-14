import { useCallback, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { WidgetData, ChartLayerItem } from '@/types'
import { useThemeStore } from '@/store/themeStore'
import LayerTogglePanel from '@/components/interactive/LayerTogglePanel'
import { mergeAnnotationsIntoOption } from '@/components/charts/buildAnnotationOptions'
import { buildRichTooltip } from '@/components/charts/buildRichTooltip'
import type { AnnotationItem, TooltipConfigItem } from '@/api/visualization'
import { isCustomChartType, buildCustomChart } from '@/components/charts/chartTypeBuilders'

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

    // Base: first column = category, rest = series
    const categoryCol = cols[0]
    const categories = rows.map(r => String(r[categoryCol] ?? ''))

    // Determine if we need dual axis
    const hasRightAxis = layersWithVisibility.some(l => l.axis === 'right' && l.isVisible)

    // Build base series from widget data (if no layers, use old logic)
    const series: any[] = []

    if (layersWithVisibility.length === 0) {
      // Classic: all non-category columns as series
      const seriesCols = cols.slice(1)
      seriesCols.forEach(col => {
        if (chartType === 'pie') {
          series.push({
            name: col, type: 'pie', radius: ['40%', '70%'],
            data: rows.map(r => ({ name: String(r[categoryCol] ?? ''), value: r[col] ?? 0 })),
          })
        } else {
          series.push({
            name: col, type: chartType,
            data: rows.map(r => r[col] ?? 0),
            smooth: chartType === 'line',
          })
        }
      })
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

    let result = {
      ...tooltipOpts,
      legend: series.length > 1 ? { bottom: 0, type: 'scroll' } : undefined,
      grid: {
        left: '3%',
        right: hasRightAxis ? '8%' : '4%',
        bottom: series.length > 1 ? '15%' : '3%',
        containLabel: true,
      },
      ...(!isPie ? {
        xAxis: { type: 'category', data: categories },
        yAxis,
      } : {}),
      series,
      ...(emphasisConfig || {}),
      ...((config.option as object) || {}),
    }

    if (annotations && annotations.length > 0) {
      result = mergeAnnotationsIntoOption(result, annotations)
    }

    return result
  }, [data, config, layersWithVisibility, layerData, highlightField, highlightValue, annotations, tooltipConfig])

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
          theme={isDark ? 'dark' : undefined}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents}
        />
      </div>
    </div>
  )
}
