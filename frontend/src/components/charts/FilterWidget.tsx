import { useMemo, useState } from 'react'
import type { WidgetData } from '@/types'

interface FilterConfig {
  filterColumn?: string
  filterType?: 'select' | 'multi_select' | 'text' | 'number_range' | 'date_range'
  placeholder?: string
}

interface Props {
  data: WidgetData
  chartConfig?: string
  onApplyFilter?: (field: string, value: string) => void
}

export default function FilterWidget({ data, chartConfig, onApplyFilter }: Props) {
  const config: FilterConfig = useMemo(() => {
    if (!chartConfig) return {}
    try { return JSON.parse(chartConfig) as FilterConfig } catch { return {} }
  }, [chartConfig])

  const filterColumn = config.filterColumn || data.columns[0]
  const filterType = config.filterType || 'select'
  const placeholder = config.placeholder || filterColumn || ''

  const [textValue, setTextValue] = useState('')
  const [minValue, setMinValue] = useState('')
  const [maxValue, setMaxValue] = useState('')

  const values = useMemo(() => {
    if (!filterColumn) return []
    return [...new Set(data.rows.map(row => String(row[filterColumn] ?? '')))].filter(Boolean).slice(0, 1000)
  }, [data.rows, filterColumn])

  if (!filterColumn) {
    return <div className="h-full flex items-center text-slate-400 text-sm">No filter column</div>
  }

  if (filterType === 'text') {
    return (
      <div className="h-full flex flex-col">
        <p className="text-xs text-slate-500 mb-2">{filterColumn}</p>
        <input
          className="input text-sm"
          value={textValue}
          placeholder={placeholder}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={() => onApplyFilter?.(filterColumn, textValue)}
        />
      </div>
    )
  }

  if (filterType === 'number_range' || filterType === 'date_range') {
    const inputType = filterType === 'date_range' ? 'date' : 'number'
    const applyRange = () => {
      onApplyFilter?.(filterColumn, JSON.stringify({ min: minValue || null, max: maxValue || null }))
    }
    return (
      <div className="h-full flex flex-col">
        <p className="text-xs text-slate-500 mb-2">{filterColumn}</p>
        <div className="flex gap-2">
          <input
            type={inputType}
            className="input text-sm flex-1"
            placeholder="min"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            onBlur={applyRange}
          />
          <input
            type={inputType}
            className="input text-sm flex-1"
            placeholder="max"
            value={maxValue}
            onChange={(e) => setMaxValue(e.target.value)}
            onBlur={applyRange}
          />
        </div>
      </div>
    )
  }

  if (filterType === 'multi_select') {
    return (
      <div className="h-full flex flex-col">
        <p className="text-xs text-slate-500 mb-2">{filterColumn}</p>
        <select
          className="input text-sm flex-1 min-h-[120px]"
          multiple
          onChange={(e) => {
            const selected = Array.from(e.currentTarget.selectedOptions).map(o => o.value)
            onApplyFilter?.(filterColumn, selected.join(','))
          }}
        >
          {values.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <p className="text-xs text-slate-500 mb-2">{filterColumn}</p>
      <select
        className="input text-sm"
        defaultValue=""
        onChange={(e) => onApplyFilter?.(filterColumn, e.target.value)}
      >
        <option value="">- {values.length} values -</option>
        {values.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  )
}
