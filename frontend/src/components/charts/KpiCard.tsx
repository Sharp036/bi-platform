import type { WidgetData } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'

interface Props { data: WidgetData; title?: string; chartConfig?: string }

function parseConfig(raw?: string) {
  if (!raw) return {} as Record<string, string>
  try { return JSON.parse(raw) } catch { return {} as Record<string, string> }
}

export default function KpiCard({ data, title, chartConfig }: Props) {
  const config = parseConfig(chartConfig)
  const row = data.rows?.[0] || {}
  const cols = data.columns || []

  const valueCol = config.valueColumn || cols[0]
  const deltaCol = config.deltaColumn || cols[1]
  const value = row[valueCol]
  const delta = deltaCol ? Number(row[deltaCol]) : undefined
  const prefix = config.prefix || ''
  const suffix = config.suffix || ''

  const formatted = typeof value === 'number'
    ? `${prefix}${value.toLocaleString()}${suffix}`
    : `${prefix}${value ?? '—'}${suffix}`

  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0

  return (
    <div className="h-full flex flex-col justify-center px-4">
      {title && <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>}
      <p className="text-3xl font-bold text-slate-800 dark:text-white">{formatted}</p>
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
    </div>
  )
}
