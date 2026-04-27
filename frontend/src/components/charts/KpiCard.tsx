import type { WidgetData } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'

interface Props { data: WidgetData; title?: string; chartConfig?: string }

type ColorStop = { at: number; color: string }
type ColorMode = 'step' | 'gradient'

interface KpiConfig {
  valueColumn?: string
  deltaColumn?: string
  prefix?: string
  suffix?: string
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

function parseSparklineValues(cell: unknown, rows: Array<Record<string, unknown>>, field: string): number[] {
  // Priority 1: cell itself contains the trend (array or comma/JSON string).
  if (Array.isArray(cell)) return cell.map(Number).filter(Number.isFinite)
  if (typeof cell === 'string' && cell.length > 0) {
    const trimmed = cell.trim()
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite)
      } catch { /* fall through */ }
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(s => Number(s.trim())).filter(Number.isFinite)
    }
  }
  // Priority 2: trend spans across multiple data rows via the same field.
  if (rows.length > 1) {
    return rows.map(r => Number(r[field])).filter(Number.isFinite)
  }
  return []
}

function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : 0
  return values.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
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
  const sparklineValues = sparklineField
    ? parseSparklineValues(row[sparklineField], rows, sparklineField)
    : []
  // When the sparkline spans multiple rows (priority 2 of parseSparklineValues),
  // the KPI's main value should be the LATEST point, not the first. SQL is expected
  // to ORDER BY date ASC so the sparkline renders chronologically - last row = latest.
  const primaryRow = sparklineField && rows.length > 1 && !Array.isArray(row[sparklineField])
    ? rows[rows.length - 1]
    : row
  const primaryValue = sparklineField && primaryRow !== row
    ? primaryRow[valueCol]
    : value
  const numericValue = typeof primaryValue === 'number' ? primaryValue : Number(primaryValue)

  const formatted = typeof primaryValue === 'number'
    ? `${prefix}${primaryValue.toLocaleString()}${suffix}`
    : `${prefix}${primaryValue ?? '—'}${suffix}`

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
  const sparklinePath = sparklineValues.length > 1
    ? buildSparklinePath(sparklineValues, 100, 24)
    : ''

  return (
    <div className="h-full flex flex-col justify-center px-4 rounded-lg" style={tintStyle}>
      {title && <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>}
      <p
        className={clsx('text-3xl font-bold', !statusColor && 'text-slate-800 dark:text-white')}
        style={statusColor ? { color: statusColor } : undefined}
      >
        {formatted}
      </p>
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
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          className="mt-1 w-full h-6"
          aria-hidden="true"
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
        </svg>
      )}
    </div>
  )
}
