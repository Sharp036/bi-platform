import { useTranslation } from 'react-i18next'
import { X, Filter } from 'lucide-react'
import clsx from 'clsx'

export interface ActiveFilter {
  sourceWidgetId: number
  sourceWidgetTitle: string
  field: string
  value: unknown
}

interface GlobalFilterBarProps {
  filters: ActiveFilter[]
  onClearFilter: (sourceWidgetId: number) => void
  onClearAll: () => void
}

export default function GlobalFilterBar({ filters, onClearFilter, onClearAll }: GlobalFilterBarProps) {
  const { t } = useTranslation()

  if (filters.length === 0) return null

  return (
    <div className="card px-4 py-2 mb-3 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
        <Filter className="w-3.5 h-3.5" />
        {t('interactive.active_filters')}
      </div>

      {filters.map(f => (
        <span
          key={`${f.sourceWidgetId}-${f.field}`}
          className={clsx(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
            'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
          )}
        >
          <span className="text-brand-500 dark:text-brand-300">{f.sourceWidgetTitle}:</span>
          {f.field} = {String(f.value)}
          <button
            onClick={() => onClearFilter(f.sourceWidgetId)}
            className="ml-0.5 hover:text-red-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-red-500 ml-1 transition-colors"
        >
          {t('interactive.clear_all')}
        </button>
      )}
    </div>
  )
}
