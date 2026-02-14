import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { ContainerItem } from '@/api/visualization'

interface TabContainerProps {
  container: ContainerItem
  children: React.ReactNode[]   // child widget elements in order of childWidgetIds
}

export default function TabContainer({ container, children }: TabContainerProps) {
  const { t } = useTranslation()
  const [activeIdx, setActiveIdx] = useState(container.activeTab || 0)
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set([0]))

  const labels = children.map((_, i) => t('interactive.tab_default', { number: i + 1 }))

  if (container.containerType === 'TABS') {
    return (
      <div className="h-full flex flex-col">
        {/* Tab header */}
        <div className="flex border-b border-surface-200 dark:border-dark-surface-100 mb-2 flex-shrink-0">
          {labels.map((label, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={clsx(
                'px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                i === activeIdx
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Active tab content */}
        <div className="flex-1 min-h-0">
          {children[activeIdx] || null}
        </div>
      </div>
    )
  }

  if (container.containerType === 'ACCORDION') {
    const toggleExpand = (idx: number) => {
      setExpandedSet(prev => {
        const next = new Set(prev)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        return next
      })
    }

    return (
      <div className="space-y-1">
        {children.map((child, i) => (
          <div key={i} className="card overflow-hidden">
            <button
              onClick={() => toggleExpand(i)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium
                text-slate-700 dark:text-slate-200 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
            >
              {expandedSet.has(i)
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />}
              {labels[i]}
            </button>
            {expandedSet.has(i) && (
              <div className="px-3 pb-3">
                {child}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (container.containerType === 'HORIZONTAL') {
    return (
      <div className={clsx(
        'h-full flex gap-3',
        container.autoDistribute && 'children-equal-width'
      )} style={container.autoDistribute ? {} : undefined}>
        {children.map((child, i) => (
          <div key={i} className={container.autoDistribute ? 'flex-1 min-w-0' : ''}>
            {child}
          </div>
        ))}
      </div>
    )
  }

  // VERTICAL (default)
  return (
    <div className="space-y-3">
      {children.map((child, i) => (
        <div key={i}>{child}</div>
      ))}
    </div>
  )
}
