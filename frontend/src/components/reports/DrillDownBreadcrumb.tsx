import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbEntry {
  reportId: number
  reportName: string
  parameters: Record<string, unknown>
  label: string
}

interface Props {
  stack: BreadcrumbEntry[]
  onNavigate: (index: number) => void
}

export default function DrillDownBreadcrumb({ stack, onNavigate }: Props) {
  if (stack.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 mb-3 px-1 py-2 text-sm overflow-x-auto">
      {stack.map((entry, idx) => {
        const isLast = idx === stack.length - 1
        const isFirst = idx === 0
        return (
          <span key={idx} className="flex items-center gap-1 flex-shrink-0">
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
            {isLast ? (
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {entry.label}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(idx)}
                className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline"
              >
                {isFirst && <Home className="w-3.5 h-3.5" />}
                <span>{entry.label}</span>
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
