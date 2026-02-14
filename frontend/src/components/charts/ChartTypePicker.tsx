import { CHART_TYPE_OPTIONS } from '@/components/charts/chartTypeBuilders'
import clsx from 'clsx'

interface Props {
  value: string
  onChange: (type: string) => void
  compact?: boolean
}

export default function ChartTypePicker({ value, onChange, compact }: Props) {
  if (compact) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input text-xs py-1"
      >
        {CHART_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.icon} {opt.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {CHART_TYPE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs transition-all',
            value === opt.value
              ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-900/30 dark:text-brand-400 dark:ring-brand-700'
              : 'bg-surface-50 text-slate-600 hover:bg-surface-100 dark:bg-dark-surface-100 dark:text-slate-400 dark:hover:bg-dark-surface-200'
          )}
        >
          <span className="text-lg">{opt.icon}</span>
          <span className="font-medium truncate w-full text-center">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
