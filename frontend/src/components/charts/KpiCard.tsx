import { useState } from 'react'
import type { WidgetData } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'
import InfoTooltip from '@/components/common/InfoTooltip'
import { buildValueFormatter } from '@/utils/formatValue'

interface Props { data: WidgetData; title?: string; chartConfig?: string }

type ColorStop = { at: number; color: string }
type ColorMode = 'step' | 'gradient'
type SparklinePoint = { label: string; value: number }

type Aggregation = 'first' | 'last' | 'sum' | 'avg' | 'min' | 'max' | 'count'

interface KpiConfig {
  valueColumn?: string
  deltaColumn?: string
  // Optional column whose value (from row[0]) is rendered as a small caption
  // below the main number (e.g. the report week or as-of date).
  labelColumn?: string
  // How to compute the displayed value across rows of the SQL result.
  // 'first' (default) takes row[0]; 'last' takes the last row; 'sum'/'avg'/
  // 'min'/'max' aggregate the valueColumn numerically; 'count' returns the
  // row count. When sparklineField is set with multi-row data and aggregation
  // is not specified, defaults to 'last' so the KPI shows the most recent
  // point - keeps the prior implicit behavior intact.
  aggregation?: Aggregation
  prefix?: string
  suffix?: string
  // Display format applied to the numeric value before prefix/suffix.
  // 'number' is treated as a synonym of 'plain' (kept for backward compat
  // with existing reports that wrote 'number' before this field was honored).
  format?: 'number' | 'plain' | 'thousands' | 'millions' | 'billions' | 'currency' | 'percent'
  // Override decimal places. When omitted, format-specific defaults apply
  // (currency 0, percent/thousands/millions/billions 1, plain raw via toLocaleString).
  decimals?: number
  // ISO 4217 code used when format=currency. Defaults to 'USD'.
  currency?: string
  colorMode?: ColorMode
  colorStops?: ColorStop[]
  // When true, the card background is tinted with the resolved color (low alpha).
  // Otherwise only the value text is colored.
  tintBackground?: boolean
  // Sparkline: small trend line across all data rows' values in `sparklineField`.
  // If `sparklineField` is an array cell (ClickHouse groupArray) it is used directly;
  // if it's a comma-separated/JSON string it is parsed; otherwise values are read
  // from all rows of the data (row[sparklineField] per row).
  sparklineField?: string
  sparklineColor?: string
  // When set, sparkline uses the same colorStops to pick its stroke color based on
  // the LAST data point's value. Useful to make the sparkline go red/green too.
  sparklineColorFromStops?: boolean
  // Free-form description shown as a markdown tooltip on a small (i) icon next
  // to the title. Empty/undefined hides the icon entirely.
  description?: string
}

function parseConfig(raw?: string): KpiConfig {
  if (!raw) return {}
  try { return JSON.parse(raw) as KpiConfig } catch { return {} }
}

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

// Resolves a color for `value` using the provided color stops.
// - step mode: returns the color of the first stop whose `at` is >= value, or the last stop's color
//   if value exceeds the largest stop. Natural for thresholds like "red <0.4, yellow <0.7, green else".
// - gradient mode: linearly interpolates RGB between the two stops that bracket the value.
//   Values outside the stop range clamp to the first/last stop color.
function pickColor(value: number, stops: ColorStop[], mode: ColorMode): string | undefined {
  if (!stops.length || !Number.isFinite(value)) return undefined
  const sorted = [...stops].sort((a, b) => a.at - b.at)

  if (mode === 'step') {
    for (const stop of sorted) {
      if (value <= stop.at) return stop.color
    }
    return sorted[sorted.length - 1].color
  }

  // gradient
  if (value <= sorted[0].at) return sorted[0].color
  if (value >= sorted[sorted.length - 1].at) return sorted[sorted.length - 1].color

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (value >= a.at && value <= b.at) {
      const span = b.at - a.at || 1
      const t = (value - a.at) / span
      const aRgb = hexToRgb(a.color)
      const bRgb = hexToRgb(b.color)
      if (!aRgb || !bRgb) return a.color
      return rgbToHex(
        aRgb[0] + (bRgb[0] - aRgb[0]) * t,
        aRgb[1] + (bRgb[1] - aRgb[1]) * t,
        aRgb[2] + (bRgb[2] - aRgb[2]) * t,
      )
    }
  }
  return undefined
}

function parseSparklinePoints(
  cell: unknown,
  rows: Array<Record<string, unknown>>,
  field: string,
  labelField: string | undefined,
): SparklinePoint[] {
  // Priority 1: cell itself contains the trend (array or comma/JSON string).
  // No labels available - fall back to 1-based index.
  const fromArr = (arr: unknown[]): SparklinePoint[] => arr
    .map((v, i) => ({ label: String(i + 1), value: Number(v) }))
    .filter(p => Number.isFinite(p.value))

  if (Array.isArray(cell)) return fromArr(cell)
  if (typeof cell === 'string' && cell.length > 0) {
    const trimmed = cell.trim()
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return fromArr(parsed)
      } catch { /* fall through */ }
    }
    if (trimmed.includes(',')) {
      return fromArr(trimmed.split(',').map(s => s.trim()))
    }
  }
  // Priority 2: trend spans across multiple data rows. Pull a paired label
  // from labelField when available (typically the X-axis column - week/date).
  if (rows.length > 1) {
    return rows
      .map(r => ({
        label: labelField ? String(r[labelField] ?? '') : '',
        value: Number(r[field]),
      }))
      .filter(p => Number.isFinite(p.value))
  }
  return []
}

// Vertical inset for sparkline drawing area: keeps the line stroke a few px
// inside the SVG so min/max points (and the hover marker on them) are not
// half-clipped at the top or bottom edges.
const SPARK_PAD_Y = 3

function sparkY(value: number, min: number, range: number, height: number): number {
  const drawH = Math.max(1, height - 2 * SPARK_PAD_Y)
  return SPARK_PAD_Y + drawH - ((value - min) / range) * drawH
}

function buildSparklinePath(points: SparklinePoint[], width: number, height: number, min: number, range: number): string {
  if (points.length === 0) return ''
  const step = points.length > 1 ? width / (points.length - 1) : 0
  return points.map((p, i) => {
    const x = i * step
    const y = sparkY(p.value, min, range, height)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export default function KpiCard({ data, title, chartConfig }: Props) {
  const config = parseConfig(chartConfig)
  const rows = data.rows || []
  const row = rows[0] || {}
  const cols = data.columns || []

  const valueCol = config.valueColumn || cols[0]
  const deltaCol = config.deltaColumn || cols[1]
  const value = row[valueCol]
  const delta = deltaCol ? Number(row[deltaCol]) : undefined
  const prefix = config.prefix || ''
  const suffix = config.suffix || ''

  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0

  const sparklineField = config.sparklineField
  // Pick a label column for sparkline points: first column that is not the
  // value/sparkline/delta column. Typical SQL shape: SELECT x_label, y_value FROM ...
  // - so the first non-value column happens to be the X axis.
  const labelField = cols.find(c => c !== valueCol && c !== sparklineField && c !== deltaCol)
  const sparklinePoints = sparklineField
    ? parseSparklinePoints(row[sparklineField], rows, sparklineField, labelField)
    : []
  // Resolve aggregation: explicit config wins; otherwise default to 'last'
  // when there is a multi-row sparkline (preserves prior implicit behavior of
  // showing the latest point), else 'first'.
  const sparkSpansRows = !!sparklineField && rows.length > 1 && !Array.isArray(row[sparklineField])
  const aggregation: Aggregation = (config.aggregation as Aggregation | undefined)
    ?? (sparkSpansRows ? 'last' : 'first')

  let primaryValue: unknown
  if (rows.length === 0) {
    primaryValue = value
  } else if (aggregation === 'count') {
    primaryValue = rows.length
  } else if (aggregation === 'first') {
    primaryValue = row[valueCol]
  } else if (aggregation === 'last') {
    primaryValue = rows[rows.length - 1][valueCol]
  } else {
    const nums = rows.map(r => Number(r[valueCol])).filter(Number.isFinite)
    if (nums.length === 0) {
      primaryValue = value
    } else if (aggregation === 'sum') {
      primaryValue = nums.reduce((a, b) => a + b, 0)
    } else if (aggregation === 'avg') {
      primaryValue = nums.reduce((a, b) => a + b, 0) / nums.length
    } else if (aggregation === 'min') {
      primaryValue = Math.min(...nums)
    } else if (aggregation === 'max') {
      primaryValue = Math.max(...nums)
    } else {
      primaryValue = value
    }
  }
  // Coerce to number for formatter handling. ClickHouse returns Decimal types
  // as strings (e.g. "18.4300") - Number() drops trailing zeros and gives a
  // finite JS number we can format consistently with other widget types.
  const numericValue = typeof primaryValue === 'number' ? primaryValue : Number(primaryValue)
  const hasNumeric = primaryValue != null && primaryValue !== '' && Number.isFinite(numericValue)
  // 'number' is a legacy alias for 'plain' (older reports stored it before
  // this field was honored). Treat them identically so existing configs
  // keep their semantics after this change.
  const fmtKey = config.format === 'number' ? 'plain' : (config.format || 'plain')
  const formatter = hasNumeric
    ? buildValueFormatter(fmtKey, config.currency || 'USD', config.decimals)
    : undefined

  const displayValue = formatter
    ? formatter(numericValue)
    : hasNumeric
      ? numericValue.toLocaleString()
      : String(primaryValue ?? '—')
  const formatted = `${prefix}${displayValue}${suffix}`

  const colorMode: ColorMode = config.colorMode === 'gradient' ? 'gradient' : 'step'
  const statusColor = config.colorStops && config.colorStops.length > 0
    ? pickColor(numericValue, config.colorStops, colorMode)
    : undefined

  // Semi-transparent background tint - only when explicitly enabled. Default: color the
  // number itself, leave the card background neutral so the overall dashboard stays calm.
  const tintStyle = statusColor && config.tintBackground
    ? { backgroundColor: statusColor + '1A' }  // ~10% alpha
    : undefined
  const sparklineColor = config.sparklineColorFromStops && statusColor
    ? statusColor
    : config.sparklineColor || '#3b82f6'

  const SVG_W = 100
  const SVG_H = 24
  const sparkValues = sparklinePoints.map(p => p.value)
  const sparkMin = sparkValues.length ? Math.min(...sparkValues) : 0
  const sparkMax = sparkValues.length ? Math.max(...sparkValues) : 0
  const sparkRange = sparkMax - sparkMin || 1
  const sparklinePath = sparklinePoints.length > 1
    ? buildSparklinePath(sparklinePoints, SVG_W, SVG_H, sparkMin, sparkRange)
    : ''

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const onSparkMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (sparklinePoints.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const xRel = (e.clientX - rect.left) / rect.width
    const exact = xRel * (sparklinePoints.length - 1)
    const idx = Math.max(0, Math.min(sparklinePoints.length - 1, Math.round(exact)))
    if (idx !== hoverIdx) setHoverIdx(idx)
  }

  const hoverPoint = hoverIdx !== null ? sparklinePoints[hoverIdx] : null
  const hoverX = hoverIdx !== null && sparklinePoints.length > 1
    ? (hoverIdx / (sparklinePoints.length - 1)) * SVG_W
    : 0
  const hoverY = hoverPoint
    ? sparkY(hoverPoint.value, sparkMin, sparkRange, SVG_H)
    : 0

  return (
    <div className="h-full flex flex-col justify-center px-4 rounded-lg" style={tintStyle}>
      {(title || config.description) && (
        <div className="flex items-center gap-1 mb-1">
          {title && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {title}
            </p>
          )}
          <InfoTooltip description={config.description} />
        </div>
      )}
      <p
        className={clsx('text-3xl font-bold', !statusColor && 'text-slate-800 dark:text-white')}
        style={statusColor ? { color: statusColor } : undefined}
      >
        {formatted}
      </p>
      {config.labelColumn && row[config.labelColumn] != null && row[config.labelColumn] !== '' && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
          {String(row[config.labelColumn])}
        </p>
      )}
      {delta !== undefined && (
        <div className={clsx(
          'flex items-center gap-1 mt-1 text-sm font-medium',
          isPositive && 'text-emerald-600 dark:text-emerald-400',
          isNegative && 'text-red-600 dark:text-red-400',
          !isPositive && !isNegative && 'text-slate-500'
        )}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : isNegative ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          {delta > 0 ? '+' : ''}{delta}%
        </div>
      )}
      {sparklinePath && (
        <div className="relative mt-1 w-full h-6">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            className="w-full h-full"
            onMouseMove={onSparkMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <path
              d={sparklinePath}
              fill="none"
              stroke={sparklineColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {hoverPoint && (
              <circle
                cx={hoverX}
                cy={hoverY}
                r="2.5"
                fill={sparklineColor}
                stroke="white"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </svg>
          {hoverPoint && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 bg-slate-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap shadow"
              style={{
                left: `${(hoverIdx! / (sparklinePoints.length - 1)) * 100}%`,
                top: '-22px',
              }}
            >
              {hoverPoint.label && <span className="opacity-80">{hoverPoint.label}: </span>}
              <strong>{Number.isFinite(hoverPoint.value) ? hoverPoint.value.toLocaleString() : '—'}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
