/**
 * Chart Type Builders
 * 
 * Transforms raw WidgetData into ECharts option fragments for each chart type.
 * Each builder returns { series, xAxis?, yAxis?, visualMap?, radar?, geo?, ... }
 * that gets merged into the final ECharts option.
 */

import type { WidgetData } from '@/types'

type ChartConfig = Record<string, any>

interface BuildResult {
  series: any[]
  xAxis?: any
  yAxis?: any
  visualMap?: any
  radar?: any
  tooltip?: any
  grid?: any
  [key: string]: any
}

// ═══════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════

function getCols(data: WidgetData) {
  const cols = data.columns || []
  const rows = data.rows || []
  const categoryCol = cols[0]
  const categories = rows.map(r => String(r[categoryCol] ?? ''))
  const valueCols = cols.slice(1)
  return { cols, rows, categoryCol, categories, valueCols }
}

// ═══════════════════════════════════════════
//  Radar
// ═══════════════════════════════════════════

export function buildRadar(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, categoryCol, categories, valueCols } = getCols(data)

  // indicator = category names with max values
  const indicator = categories.map(name => {
    const vals = rows
      .filter(r => String(r[categoryCol]) === name)
      .flatMap(r => valueCols.map(c => Number(r[c]) || 0))
    const max = Math.max(...vals, 100) * 1.2
    return { name, max: Math.ceil(max) }
  })

  // Each value column = one radar series
  const seriesData = valueCols.map(col => ({
    name: col,
    value: rows.map(r => Number(r[col]) || 0),
  }))

  return {
    radar: { indicator, shape: config.radarShape || 'polygon' },
    series: [{
      type: 'radar',
      data: seriesData,
      areaStyle: config.radarFill !== false ? { opacity: 0.15 } : undefined,
    }],
    tooltip: { trigger: 'item' },
  }
}

// ═══════════════════════════════════════════
//  Heatmap
// ═══════════════════════════════════════════

export function buildHeatmap(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, cols } = getCols(data)

  // Expects 3 columns: xCategory, yCategory, value
  const xCol = cols[0], yCol = cols[1], vCol = cols[2]
  const xCategories = [...new Set(rows.map(r => String(r[xCol] ?? '')))]
  const yCategories = [...new Set(rows.map(r => String(r[yCol] ?? '')))]

  const heatData = rows.map(r => {
    const xi = xCategories.indexOf(String(r[xCol] ?? ''))
    const yi = yCategories.indexOf(String(r[yCol] ?? ''))
    return [xi, yi, Number(r[vCol]) || 0]
  })

  const values = heatData.map(d => d[2] as number)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)

  return {
    xAxis: { type: 'category', data: xCategories, splitArea: { show: true } },
    yAxis: { type: 'category', data: yCategories, splitArea: { show: true } },
    visualMap: {
      min, max, calculable: true,
      orient: 'horizontal', left: 'center', bottom: 0,
      inRange: {
        color: config.heatmapColors || ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027'],
      },
    },
    series: [{
      type: 'heatmap', data: heatData,
      label: { show: config.heatmapLabel !== false, fontSize: 10 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
    tooltip: {
      position: 'top',
      formatter: (p: any) => {
        const [xi, yi, val] = p.data
        return `${xCategories[xi]} × ${yCategories[yi]}: <strong>${val}</strong>`
      },
    },
    grid: { left: '15%', right: '10%', bottom: '20%', top: '5%' },
  }
}

// ═══════════════════════════════════════════
//  Treemap
// ═══════════════════════════════════════════

export function buildTreemap(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, categoryCol, valueCols } = getCols(data)
  const valueCol = valueCols[0]

  // Flat list → treemap children
  const children = rows.map(r => ({
    name: String(r[categoryCol] ?? ''),
    value: Number(r[valueCol] ?? 0),
  }))

  return {
    series: [{
      type: 'treemap',
      data: children,
      breadcrumb: { show: config.treemapBreadcrumb !== false },
      label: { show: true, formatter: '{b}\n{c}' },
      levels: [
        { itemStyle: { borderWidth: 2, borderColor: '#fff', gapWidth: 2 } },
      ],
    }],
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
  }
}

// ═══════════════════════════════════════════
//  Funnel
// ═══════════════════════════════════════════

export function buildFunnel(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, categoryCol, valueCols } = getCols(data)
  const valueCol = valueCols[0]

  const funnelData = rows.map(r => ({
    name: String(r[categoryCol] ?? ''),
    value: Number(r[valueCol] ?? 0),
  }))

  return {
    series: [{
      type: 'funnel',
      data: funnelData,
      sort: config.funnelSort || 'descending',
      gap: config.funnelGap ?? 2,
      label: { show: true, position: config.funnelLabelPos || 'inside' },
      emphasis: { label: { fontSize: 14 } },
      left: '10%', right: '10%', top: '10%', bottom: '10%',
    }],
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
  }
}

// ═══════════════════════════════════════════
//  Gauge
// ═══════════════════════════════════════════

export function buildGauge(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, cols } = getCols(data)
  const row = rows[0] || {}

  // Single value gauge or multi-pointer
  const gaugeData = cols.slice(0, config.gaugePointers || 1).map(col => ({
    name: col,
    value: Number(row[col]) || 0,
  }))

  return {
    series: [{
      type: 'gauge',
      data: gaugeData,
      min: config.gaugeMin ?? 0,
      max: config.gaugeMax ?? 100,
      splitNumber: config.gaugeSplits ?? 10,
      progress: { show: config.gaugeProgress !== false },
      detail: {
        formatter: config.gaugeFormat || '{value}',
        fontSize: config.gaugeFontSize || 24,
      },
      axisLine: {
        lineStyle: {
          width: config.gaugeWidth || 20,
          color: config.gaugeColors || [
            [0.3, '#67e0e3'], [0.7, '#37a2da'], [1, '#fd666d']
          ],
        },
      },
    }],
    tooltip: { formatter: '{b}: {c}' },
  }
}

// ═══════════════════════════════════════════
//  Sankey
// ═══════════════════════════════════════════

export function buildSankey(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, cols } = getCols(data)

  // Expects 3 columns: source, target, value
  const srcCol = cols[0], tgtCol = cols[1], valCol = cols[2]

  const nodeSet = new Set<string>()
  const links: { source: string; target: string; value: number }[] = []

  rows.forEach(r => {
    const src = String(r[srcCol] ?? '')
    const tgt = String(r[tgtCol] ?? '')
    const val = Number(r[valCol]) || 0
    nodeSet.add(src)
    nodeSet.add(tgt)
    links.push({ source: src, target: tgt, value: val })
  })

  const nodes = [...nodeSet].map(name => ({ name }))

  return {
    series: [{
      type: 'sankey',
      data: nodes,
      links,
      emphasis: { focus: 'adjacency' },
      lineStyle: { color: 'gradient', curveness: 0.5 },
      orient: config.sankeyOrient || 'horizontal',
      nodeWidth: config.sankeyNodeWidth || 20,
      nodeGap: config.sankeyNodeGap || 12,
    }],
    tooltip: { trigger: 'item' },
  }
}

// ═══════════════════════════════════════════
//  Boxplot
// ═══════════════════════════════════════════

export function buildBoxplot(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, categoryCol, categories, valueCols } = getCols(data)

  // Group numeric values by category
  const grouped: Record<string, number[]> = {}
  categories.forEach(cat => { grouped[cat] = [] })

  rows.forEach(r => {
    const cat = String(r[categoryCol] ?? '')
    valueCols.forEach(col => {
      const v = Number(r[col])
      if (!isNaN(v)) (grouped[cat] ||= []).push(v)
    })
  })

  // Calculate boxplot stats: [min, Q1, median, Q3, max]
  const uniqueCats = [...new Set(categories)]
  const boxData = uniqueCats.map(cat => {
    const vals = (grouped[cat] || []).sort((a, b) => a - b)
    if (vals.length === 0) return [0, 0, 0, 0, 0]
    const q1 = quantile(vals, 0.25)
    const median = quantile(vals, 0.5)
    const q3 = quantile(vals, 0.75)
    return [vals[0], q1, median, q3, vals[vals.length - 1]]
  })

  return {
    xAxis: { type: 'category', data: uniqueCats },
    yAxis: { type: 'value' },
    series: [{ type: 'boxplot', data: boxData }],
    tooltip: { trigger: 'item' },
    grid: { left: '10%', right: '5%', bottom: '10%', top: '10%' },
  }
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }
  return sorted[base]
}

// ═══════════════════════════════════════════
//  Waterfall
// ═══════════════════════════════════════════

export function buildWaterfall(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, categoryCol, categories, valueCols } = getCols(data)
  const valueCol = valueCols[0]

  const values = rows.map(r => Number(r[valueCol]) || 0)

  // Build stacked bar: invisible base + visible delta
  let cumulative = 0
  const baseData: (number | string)[] = []
  const positiveData: (number | string)[] = []
  const negativeData: (number | string)[] = []

  values.forEach((v) => {
    if (v >= 0) {
      baseData.push(cumulative)
      positiveData.push(v)
      negativeData.push('-')
    } else {
      baseData.push(cumulative + v)
      positiveData.push('-')
      negativeData.push(Math.abs(v))
    }
    cumulative += v
  })

  // Add total bar
  const totalCats = [...categories, config.waterfallTotalLabel || 'Total']
  baseData.push(0)
  positiveData.push(cumulative >= 0 ? cumulative : '-')
  negativeData.push(cumulative < 0 ? Math.abs(cumulative) : '-')

  return {
    xAxis: { type: 'category', data: totalCats },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Base', type: 'bar', stack: 'waterfall',
        data: baseData,
        itemStyle: { borderColor: 'transparent', color: 'transparent' },
        emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
      },
      {
        name: 'Positive', type: 'bar', stack: 'waterfall',
        data: positiveData,
        itemStyle: { color: config.waterfallPosColor || '#22c55e' },
        label: { show: true, position: 'top', fontSize: 10 },
      },
      {
        name: 'Negative', type: 'bar', stack: 'waterfall',
        data: negativeData,
        itemStyle: { color: config.waterfallNegColor || '#ef4444' },
        label: { show: true, position: 'bottom', fontSize: 10 },
      },
    ],
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '5%', bottom: '10%', top: '10%' },
  }
}

// ═══════════════════════════════════════════
//  Candlestick
// ═══════════════════════════════════════════

export function buildCandlestick(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, cols } = getCols(data)

  // Expects 5 columns: date, open, close, low, high
  const dateCol = cols[0]
  const openCol = config.openCol || cols[1]
  const closeCol = config.closeCol || cols[2]
  const lowCol = config.lowCol || cols[3]
  const highCol = config.highCol || cols[4]

  const dates = rows.map(r => String(r[dateCol] ?? ''))
  const candleData = rows.map(r => [
    Number(r[openCol]) || 0,
    Number(r[closeCol]) || 0,
    Number(r[lowCol]) || 0,
    Number(r[highCol]) || 0,
  ])

  return {
    xAxis: { type: 'category', data: dates, boundaryGap: true },
    yAxis: { type: 'value', scale: true },
    series: [{
      type: 'candlestick', data: candleData,
      itemStyle: {
        color: config.candleUpColor || '#22c55e',
        color0: config.candleDownColor || '#ef4444',
        borderColor: config.candleUpColor || '#22c55e',
        borderColor0: config.candleDownColor || '#ef4444',
      },
    }],
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: { left: '10%', right: '5%', bottom: '10%', top: '5%' },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, bottom: 0 },
    ],
  }
}

// ═══════════════════════════════════════════
//  Horizontal Bar
// ═══════════════════════════════════════════

export function buildHorizontalBar(data: WidgetData, config: ChartConfig): BuildResult {
  const { rows, categoryCol, categories, valueCols } = getCols(data)

  const series = valueCols.map(col => ({
    name: col, type: 'bar',
    data: rows.map(r => Number(r[col]) || 0),
    ...(config.stack ? { stack: 'total' } : {}),
  }))

  return {
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: categories, inverse: config.barInverse !== false },
    series,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '15%', right: '5%', bottom: '5%', top: '5%', containLabel: true },
  }
}

// ═══════════════════════════════════════════
//  Stacked (bar or area)
// ═══════════════════════════════════════════

export function buildStacked(data: WidgetData, config: ChartConfig, baseType: 'bar' | 'line' = 'bar'): BuildResult {
  const { rows, categoryCol, categories, valueCols } = getCols(data)

  const series = valueCols.map(col => ({
    name: col,
    type: baseType,
    stack: 'total',
    data: rows.map(r => Number(r[col]) || 0),
    ...(baseType === 'line' ? {
      areaStyle: { opacity: 0.4 },
      smooth: config.smooth !== false,
    } : {}),
    emphasis: { focus: 'series' },
  }))

  return {
    xAxis: { type: 'category', data: categories, boundaryGap: baseType === 'bar' },
    yAxis: { type: 'value' },
    series,
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  }
}

// ═══════════════════════════════════════════
//  Registry
// ═══════════════════════════════════════════

const CUSTOM_CHART_TYPES = new Set([
  'radar', 'heatmap', 'treemap', 'funnel', 'gauge', 'sankey',
  'boxplot', 'waterfall', 'candlestick', 'horizontal_bar',
  'stacked_bar', 'stacked_area',
])

export function isCustomChartType(type: string): boolean {
  return CUSTOM_CHART_TYPES.has(type)
}

export function buildCustomChart(type: string, data: WidgetData, config: ChartConfig): BuildResult | null {
  switch (type) {
    case 'radar': return buildRadar(data, config)
    case 'heatmap': return buildHeatmap(data, config)
    case 'treemap': return buildTreemap(data, config)
    case 'funnel': return buildFunnel(data, config)
    case 'gauge': return buildGauge(data, config)
    case 'sankey': return buildSankey(data, config)
    case 'boxplot': return buildBoxplot(data, config)
    case 'waterfall': return buildWaterfall(data, config)
    case 'candlestick': return buildCandlestick(data, config)
    case 'horizontal_bar': return buildHorizontalBar(data, config)
    case 'stacked_bar': return buildStacked(data, config, 'bar')
    case 'stacked_area': return buildStacked(data, config, 'line')
    default: return null
  }
}

/** All available chart types for UI selectors */
export const CHART_TYPE_OPTIONS = [
  { value: 'bar', label: 'Bar', icon: '📊' },
  { value: 'line', label: 'Line', icon: '📈' },
  { value: 'area', label: 'Area', icon: '🏔️' },
  { value: 'pie', label: 'Pie / Donut', icon: '🥧' },
  { value: 'scatter', label: 'Scatter', icon: '🔵' },
  { value: 'horizontal_bar', label: 'Horizontal Bar', icon: '📊' },
  { value: 'stacked_bar', label: 'Stacked Bar', icon: '📊' },
  { value: 'stacked_area', label: 'Stacked Area', icon: '🏔️' },
  { value: 'radar', label: 'Radar', icon: '🕸️' },
  { value: 'heatmap', label: 'Heatmap', icon: '🟥' },
  { value: 'treemap', label: 'Treemap', icon: '🟩' },
  { value: 'funnel', label: 'Funnel', icon: '🔻' },
  { value: 'gauge', label: 'Gauge', icon: '🎯' },
  { value: 'sankey', label: 'Sankey', icon: '🌊' },
  { value: 'boxplot', label: 'Box Plot', icon: '📦' },
  { value: 'waterfall', label: 'Waterfall', icon: '💧' },
  { value: 'candlestick', label: 'Candlestick', icon: '🕯️' },
]
