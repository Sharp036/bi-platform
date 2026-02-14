import { BarChart3, Table, Hash, Type, Filter, ImageIcon } from 'lucide-react'
import { useDesignerStore } from '@/store/useDesignerStore'
import { useTranslation } from 'react-i18next'
import type { DesignerWidget } from '@/store/useDesignerStore'

const COMPONENTS: Array<{
  type: DesignerWidget['widgetType']
  i18nKey: string
  icon: React.ElementType
  descKey: string
}> = [
  { type: 'CHART', i18nKey: 'widgets.type.chart', icon: BarChart3, descKey: 'widgets.desc.chart' },
  { type: 'TABLE', i18nKey: 'widgets.type.table', icon: Table, descKey: 'widgets.desc.table' },
  { type: 'KPI', i18nKey: 'widgets.type.kpi', icon: Hash, descKey: 'widgets.desc.kpi' },
  { type: 'TEXT', i18nKey: 'widgets.type.text', icon: Type, descKey: 'widgets.desc.text' },
  { type: 'FILTER', i18nKey: 'widgets.type.filter', icon: Filter, descKey: 'widgets.desc.filter' },
  { type: 'IMAGE', i18nKey: 'widgets.type.image', icon: ImageIcon, descKey: 'widgets.desc.image' },
]

export default function ComponentPalette() {
  const addWidget = useDesignerStore(s => s.addWidget)
  const { t } = useTranslation()

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">
        {t('widgets.components')}
      </h3>
      {COMPONENTS.map(({ type, i18nKey, icon: Icon, descKey }) => (
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
            <div className="font-medium">{t(i18nKey)}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{t(descKey)}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
