import { BarChart3, Table, Hash, Type, Filter, ImageIcon } from 'lucide-react'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'

const COMPONENTS: Array<{
  type: DesignerWidget['widgetType']
  label: string
  icon: React.ElementType
  desc: string
}> = [
  { type: 'CHART', label: 'Chart', icon: BarChart3, desc: 'Bar, line, pie, area' },
  { type: 'TABLE', label: 'Table', icon: Table, desc: 'Data grid with sorting' },
  { type: 'KPI', label: 'KPI Card', icon: Hash, desc: 'Single metric display' },
  { type: 'TEXT', label: 'Text', icon: Type, desc: 'Rich text / markdown' },
  { type: 'FILTER', label: 'Filter', icon: Filter, desc: 'Interactive filter control' },
  { type: 'IMAGE', label: 'Image', icon: ImageIcon, desc: 'Static image / logo' },
]

export default function ComponentPalette() {
  const addWidget = useDesignerStore(s => s.addWidget)

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">
        Components
      </h3>
      {COMPONENTS.map(({ type, label, icon: Icon, desc }) => (
        <button
          key={type}
          onClick={() => addWidget(type)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
            text-slate-700 dark:text-slate-300
            hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-dark-surface-100 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <div className="font-medium">{label}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{desc}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
