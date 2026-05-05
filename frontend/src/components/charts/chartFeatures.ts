/**
 * Shared chart-customization helpers used by both EChartWidget (designer
 * preview) and MultiLayerChart (runtime). Keeping the logic here avoids the
 * earlier divergence where a feature added to one rendering component would
 * silently no-op in the other.
 *
 * Convention: most helpers return a partial ECharts series patch or graphic
 * element so the caller can spread/append into its own structures. Only
 * applyBarConditionalColor mutates in place because it needs to merge with
 * existing per-data-point options that may come from other features.
 */

type ColorStop = { at: number; color: string }
type ColorMode = 'step' | 'gradient'
// Loose ECharts series shape - chart code passes through to ECharts which
// validates everything anyway. Keyed access is unavoidable here.
type SeriesPatch = Record<string, unknown>

// ─────────────────────────────────────────────────────────────────────────────
// Color picking (shared with KpiCard logic; identical algorithm)
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6 && h.length !== 3) return null
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return [r, g, b]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('')
}

export function pickThresholdColor(
  value: number,
  stops: ColorStop[],
  mode: ColorMode,
): string | undefined {
  if (!stops.length || !Number.isFinite(value)) return undefined
  const sorted = [...stops].sort((a, b) => a.at - b.at)

  if (mode === 'step') {
    for (const s of sorted) if (value <= s.at) return s.color
    return sorted[sorted.length - 1].color
  }

  if (value <= sorted[0].at) return sorted[0].color
  if (value >= sorted[sorted.length - 1].at) return sorted[sorted.length - 1].color
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    if (value >= a.at && value <= b.at) {
      const t = (value - a.at) / (b.at - a.at || 1)
      const av = hexToRgb(a.color), bv = hexToRgb(b.color)
      if (!av || !bv) return a.color
      return rgbToHex(av[0] + (bv[0] - av[0]) * t, av[1] + (bv[1] - av[1]) * t, av[2] + (bv[2] - av[2]) * t)
    }
  }
  return undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// thresholdLines: horizontal reference lines at fixed Y values.
// chartConfig.thresholdLines: Array<{ value, color?, label?, style? }>
// ─────────────────────────────────────────────────────────────────────────────

interface ThresholdLine {
  value: number | string
  color?: string
  label?: string
  style?: 'solid' | 'dashed' | 'dotted'
}

export function buildThresholdMarkLine(
  config: Record<string, unknown>,
  chartType: string,
): SeriesPatch | undefined {
  const lines = Array.isArray(config.thresholdLines) ? (config.thresholdLines as ThresholdLine[]) : []
  if (lines.length === 0 || chartType === 'pie') return undefined
  return {
    markLine: {
      symbol: ['none', 'none'],
      silent: true,
      data: lines.map(t => ({
        yAxis: Number(t.value),
        lineStyle: {
          color: t.color || '#94a3b8',
          type: t.style || 'dashed',
          width: 1.5,
        },
        label: t.label
          ? { show: true, formatter: String(t.label), position: 'insideEndTop', fontSize: 10, color: t.color || '#94a3b8' }
          : { show: false },
      })),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// markMinMax: ECharts markPoint pins for min/max of the first series.
// chartConfig.markMinMax: boolean | { min?: boolean, max?: boolean }
// ─────────────────────────────────────────────────────────────────────────────

export function buildMarkMinMaxData(
  config: Record<string, unknown>,
  chartType: string,
): Array<Record<string, unknown>> {
  const m = config.markMinMax as boolean | { min?: boolean; max?: boolean } | undefined
  if (!m || (chartType !== 'line' && chartType !== 'bar')) return []
  const flags = typeof m === 'boolean' ? { min: true, max: true } : m
  const out: Array<Record<string, unknown>> = []
  if (flags.max) out.push({ type: 'max', name: 'Max' })
  if (flags.min) out.push({ type: 'min', name: 'Min' })
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// highlightLastPoint: emphasize the last data point on a line chart with an
// optional value-driven color via colorStops (same algorithm as KpiCard).
// chartConfig.highlightLastPoint: { size?, colorMode?, colorStops? }
// Returns a markPoint data entry to merge with whatever markMinMax produced.
// ─────────────────────────────────────────────────────────────────────────────

export function buildHighlightLastData(
  config: Record<string, unknown>,
  chartType: string,
  rows: Array<Record<string, unknown>>,
  mainSeriesCol: string | undefined,
  lastCategory: unknown,
): Record<string, unknown> | undefined {
  const hl = config.highlightLastPoint as { size?: number; colorMode?: ColorMode; colorStops?: ColorStop[] } | undefined
  if (!hl || chartType !== 'line' || rows.length === 0 || !mainSeriesCol) return undefined
  const stops = Array.isArray(hl.colorStops) ? hl.colorStops : []
  const mode: ColorMode = hl.colorMode === 'gradient' ? 'gradient' : 'step'
  const size = Number(hl.size) > 0 ? Number(hl.size) : 12
  const lastValue = Number(rows[rows.length - 1][mainSeriesCol])
  const color = stops.length > 0 ? pickThresholdColor(lastValue, stops, mode) : undefined
  return {
    coord: [lastCategory, lastValue],
    symbol: 'circle',
    symbolSize: size,
    itemStyle: color ? { color, borderColor: '#ffffff', borderWidth: 2 } : undefined,
    label: { show: false },
  }
}

/**
 * Combine markMinMax pins and the highlightLastPoint marker into one markPoint
 * config patch. Returns undefined when neither feature contributes data.
 */
export function buildMarkPointPatch(
  config: Record<string, unknown>,
  chartType: string,
  rows: Array<Record<string, unknown>>,
  mainSeriesCol: string | undefined,
  lastCategory: unknown,
): SeriesPatch | undefined {
  const minMax = buildMarkMinMaxData(config, chartType)
  const last = buildHighlightLastData(config, chartType, rows, mainSeriesCol, lastCategory)
  const data: Array<Record<string, unknown>> = [...minMax, ...(last ? [last] : [])]
  if (data.length === 0) return undefined
  return {
    markPoint: {
      symbol: 'pin',
      symbolSize: 30,
      label: { fontSize: 10 },
      data,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// barConditionalColor: per-bar coloring by value vs threshold.
// chartConfig.barConditionalColor: { series?, field?, threshold, colorAbove, colorBelow }
// Mutates the target series in `series` in place because data items may
// already carry per-point options from other features (e.g. dataLabel hiding).
// ─────────────────────────────────────────────────────────────────────────────

interface BarCondConfig {
  series?: string
  field?: string
  threshold: number
  colorAbove: string
  colorBelow: string
}

export function applyBarConditionalColor(
  series: SeriesPatch[],
  config: Record<string, unknown>,
  chartType: string,
  rows: Array<Record<string, unknown>>,
  seriesCols: string[],
  nullHandling: string,
): void {
  const cfg = config.barConditionalColor as BarCondConfig | undefined
  if (!cfg || chartType !== 'bar' || series.length === 0) return
  const targetCol = cfg.series && seriesCols.includes(cfg.series) ? cfg.series : seriesCols[0]
  const compareField = cfg.field || targetCol
  const threshold = Number(cfg.threshold)
  const seriesIdx = seriesCols.indexOf(targetCol)
  if (seriesIdx < 0) return
  const coloredData = rows.map((r, dataIndex) => {
    const baseVal = r[targetCol]
    const rawValue = (baseVal == null || baseVal === '')
      ? (nullHandling === 'gap' ? '-' : 0)
      : (Number(baseVal) || 0)
    const compareVal = Number(r[compareField]) || 0
    const color = compareVal >= threshold ? cfg.colorAbove : cfg.colorBelow
    const existing = ((series[seriesIdx].data as unknown[]) || [])[dataIndex]
    const base = (existing && typeof existing === 'object') ? (existing as Record<string, unknown>) : { value: rawValue }
    const baseStyle = (base.itemStyle as Record<string, unknown> | undefined) || {}
    return { ...base, itemStyle: { ...baseStyle, color } }
  })
  series[seriesIdx] = { ...series[seriesIdx], data: coloredData }
}

// ─────────────────────────────────────────────────────────────────────────────
// deltaAnnotation: floating "▲ +5.2%" annotation in a corner, computed from
// the last two values of a chosen series. Line charts only.
// chartConfig.deltaAnnotation: { valueField?, position? }
// ─────────────────────────────────────────────────────────────────────────────

interface DeltaAnnConfig {
  valueField?: string
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export function buildDeltaGraphic(
  config: Record<string, unknown>,
  chartType: string,
  rows: Array<Record<string, unknown>>,
  seriesCols: string[],
): Record<string, unknown> | undefined {
  const ann = config.deltaAnnotation as DeltaAnnConfig | undefined
  if (!ann || chartType !== 'line' || rows.length < 2) return undefined
  const valField = ann.valueField && seriesCols.includes(ann.valueField) ? ann.valueField : seriesCols[0]
  if (!valField) return undefined
  const last = Number(rows[rows.length - 1][valField])
  const prev = Number(rows[rows.length - 2][valField])
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return undefined
  const deltaPct = ((last - prev) / Math.abs(prev)) * 100
  const arrow = deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '→'
  const color = deltaPct > 0 ? '#22c55e' : deltaPct < 0 ? '#ef4444' : '#94a3b8'
  const sign = deltaPct > 0 ? '+' : ''
  const text = `${arrow} ${sign}${deltaPct.toFixed(1)}%`
  const pos = ann.position || 'top-right'
  const isRight = pos.endsWith('right')
  const isBottom = pos.startsWith('bottom')
  return {
    type: 'text',
    [isRight ? 'right' : 'left']: 12,
    [isBottom ? 'bottom' : 'top']: 8,
    style: { text, fill: color, font: 'bold 12px sans-serif' },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// centerLabel: text in the middle of a donut chart (aggregates valueField if
// provided, else shows static text). Returns an ECharts graphic group.
// ─────────────────────────────────────────────────────────────────────────────

interface CenterLabelConfig {
  text?: string
  valueField?: string
  fontSize?: number
  color?: string
  subtext?: string
}

export function buildCenterLabelGraphic(
  config: Record<string, unknown>,
  chartType: string,
  rows: Array<Record<string, unknown>>,
  cols: string[],
  isDark: boolean,
): Record<string, unknown> | undefined {
  if (chartType !== 'pie' || !config.donut) return undefined
  const cl = config.centerLabel as CenterLabelConfig | undefined
  if (!cl) return undefined
  let mainText = cl.text ?? ''
  if (cl.valueField && cols.includes(cl.valueField)) {
    const total = rows.reduce((acc, r) => acc + (Number(r[cl.valueField!]) || 0), 0)
    mainText = total.toLocaleString()
  }
  if (!mainText && !cl.subtext) return undefined
  return {
    type: 'group',
    left: 'center',
    top: 'middle',
    children: [
      {
        type: 'text',
        left: 'center',
        top: cl.subtext ? -10 : 'center',
        style: {
          text: mainText,
          fill: cl.color || (isDark ? '#e2e8f0' : '#1e293b'),
          font: `bold ${cl.fontSize || 20}px sans-serif`,
          textAlign: 'center',
        },
      },
      ...(cl.subtext ? [{
        type: 'text',
        left: 'center',
        top: 14,
        style: {
          text: cl.subtext,
          fill: isDark ? '#94a3b8' : '#64748b',
          font: '11px sans-serif',
          textAlign: 'center',
        },
      }] : []),
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pie-specific: data with optional per-segment colors, label formatter for
// percent display, donut radius toggle.
// ─────────────────────────────────────────────────────────────────────────────

export function buildPieRadius(donut: boolean): string | [string, string] {
  return donut ? ['40%', '70%'] : '70%'
}

export function buildPieData(
  rows: Array<Record<string, unknown>>,
  categoryCol: string,
  valueCol: string,
  colorsMap: Record<string, string> | undefined,
): Array<Record<string, unknown>> {
  return rows.map(r => {
    const name = String(r[categoryCol] ?? '')
    const value = r[valueCol] ?? 0
    const color = colorsMap?.[name]
    return color ? { name, value, itemStyle: { color } } : { name, value }
  })
}

/**
 * Pie label formatter:
 *   showPercentages=true  -> "Снизить: 42.3%"
 *   showPercentages=false -> ECharts default ("Снизить" via name)
 * Returns undefined when no override is needed (lets ECharts pick its default).
 */
export function buildPieLabelFormatter(
  showPercentages: boolean | undefined,
): string | undefined {
  return showPercentages ? '{b}: {d}%' : undefined
}
