import { useTranslation } from 'react-i18next'
import { useDesignerStore } from '@/store/useDesignerStore'
import { Plus, Trash2, X, Layers } from 'lucide-react'

// ── Types ──────────────────────────────────────────────

export interface DesignerContainer {
  clientId: string
  serverId?: number
  containerType: 'TABS' | 'ACCORDION'
  name: string
  tabNames: string[]
  tabGroups: string[][]   // DesignerWidget.id per tab
}

let nextContainerId = 1
export const genContainerId = () => `c_${nextContainerId++}`

// ── Component ──────────────────────────────────────────

interface Props {
  containers: DesignerContainer[]
  onChange: (c: DesignerContainer[]) => void
}

export default function ContainerDesigner({ containers, onChange }: Props) {
  const { t } = useTranslation()
  const widgets = useDesignerStore(s => s.widgets)

  // All widget client-IDs currently assigned in any tab of a given container
  const usedIds = (c: DesignerContainer) => new Set(c.tabGroups.flat())

  const update = (clientId: string, patch: Partial<DesignerContainer>) =>
    onChange(containers.map(c => c.clientId === clientId ? { ...c, ...patch } : c))

  const addContainer = (containerType: 'TABS' | 'ACCORDION' = 'TABS') =>
    onChange([...containers, {
      clientId: genContainerId(),
      containerType,
      name: t('designer.tabs.group_name_default'),
      tabNames: [t('designer.tabs.tab_name_default', { n: 1 })],
      tabGroups: [[]]
    }])

  const removeContainer = (clientId: string) =>
    onChange(containers.filter(c => c.clientId !== clientId))

  const addTab = (c: DesignerContainer) => update(c.clientId, {
    tabNames: [...c.tabNames, t('designer.tabs.tab_name_default', { n: c.tabNames.length + 1 })],
    tabGroups: [...c.tabGroups, []]
  })

  const removeTab = (c: DesignerContainer, tabIdx: number) => {
    if (c.tabNames.length <= 1) return
    update(c.clientId, {
      tabNames: c.tabNames.filter((_, i) => i !== tabIdx),
      tabGroups: c.tabGroups.filter((_, i) => i !== tabIdx),
    })
  }

  const renameTab = (c: DesignerContainer, tabIdx: number, name: string) =>
    update(c.clientId, {
      tabNames: c.tabNames.map((n, i) => i === tabIdx ? name : n)
    })

  const addWidget = (c: DesignerContainer, tabIdx: number, widgetClientId: string) => {
    // Move widget: remove from any tab, add to the target tab
    const tabGroups = c.tabGroups.map((g, i) => {
      const clean = g.filter(id => id !== widgetClientId)
      return i === tabIdx ? [...clean, widgetClientId] : clean
    })
    update(c.clientId, { tabGroups })
  }

  const removeWidget = (c: DesignerContainer, tabIdx: number, widgetClientId: string) =>
    update(c.clientId, {
      tabGroups: c.tabGroups.map((g, i) =>
        i === tabIdx ? g.filter(id => id !== widgetClientId) : g
      )
    })

  // ── Empty state ──

  if (containers.length === 0) {
    return (
      <div className="p-4 space-y-3 text-center">
        <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t('designer.tabs.empty_hint')}
        </p>
        <button onClick={() => addContainer('TABS')} className="btn-secondary text-xs w-full">
          <Plus className="w-3.5 h-3.5" /> {t('designer.tabs.add_group')}
        </button>
        <button onClick={() => addContainer('ACCORDION')} className="btn-secondary text-xs w-full">
          <Plus className="w-3.5 h-3.5" /> {t('designer.tabs.add_accordion')}
        </button>
      </div>
    )
  }

  // ── Main render ──

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      {containers.map(c => {
        const used = usedIds(c)
        const available = widgets.filter(w => !used.has(w.id))

        return (
          <div key={c.clientId} className="border border-surface-200 dark:border-dark-surface-100 rounded-lg overflow-hidden">

            {/* Container header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 dark:bg-dark-surface-100/60">
              <Layers className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
              <input
                value={c.name}
                onChange={e => update(c.clientId, { name: e.target.value })}
                className="flex-1 bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none min-w-0"
                placeholder={t('designer.tabs.group_name_default')}
              />
              <select
                value={c.containerType}
                onChange={e => update(c.clientId, { containerType: e.target.value as DesignerContainer['containerType'] })}
                className="input text-xs py-0.5 h-auto flex-shrink-0 w-auto"
                title={t('designer.tabs.container_type')}
              >
                <option value="TABS">{t('designer.tabs.type.tabs')}</option>
                <option value="ACCORDION">{t('designer.tabs.type.accordion')}</option>
              </select>
              <button
                onClick={() => removeContainer(c.clientId)}
                className="text-slate-400 hover:text-red-500 flex-shrink-0"
                title={t('common.delete')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tabs list */}
            <div className="divide-y divide-surface-100 dark:divide-dark-surface-100">
              {c.tabNames.map((tabName, tabIdx) => (
                <div key={tabIdx} className="px-3 py-2 space-y-1.5">

                  {/* Tab name row */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 w-4 flex-shrink-0 text-right">
                      {tabIdx + 1}
                    </span>
                    <input
                      value={tabName}
                      onChange={e => renameTab(c, tabIdx, e.target.value)}
                      className="flex-1 input text-xs py-0.5"
                      placeholder={t('designer.tabs.tab_name_placeholder')}
                    />
                    {c.tabNames.length > 1 && (
                      <button
                        onClick={() => removeTab(c, tabIdx)}
                        className="text-slate-400 hover:text-red-500 flex-shrink-0"
                        title={t('common.delete')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Widgets in this tab */}
                  <div className="space-y-1 pl-6">
                    {(c.tabGroups[tabIdx] || []).map(wId => {
                      const w = widgets.find(x => x.id === wId)
                      if (!w) return null
                      return (
                        <div key={wId} className="flex items-center gap-1 text-xs group">
                          <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                            {w.title || w.widgetType}
                          </span>
                          <button
                            onClick={() => removeWidget(c, tabIdx, wId)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                            title={t('common.remove')}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}

                    {/* Add widget to tab */}
                    {available.length > 0 && (
                      <select
                        value=""
                        onChange={e => { if (e.target.value) addWidget(c, tabIdx, e.target.value) }}
                        className="input text-xs py-0.5 w-full text-slate-400"
                      >
                        <option value="">{t('designer.tabs.add_widget')}</option>
                        {available.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.title || w.widgetType}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add tab */}
            <div className="px-3 py-2 border-t border-surface-100 dark:border-dark-surface-100">
              <button
                onClick={() => addTab(c)}
                className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                <Plus className="w-3 h-3" />
                {t('designer.tabs.add_tab')}
              </button>
            </div>
          </div>
        )
      })}

      <div className="flex gap-2">
        <button onClick={() => addContainer('TABS')} className="btn-secondary text-xs flex-1">
          <Plus className="w-3.5 h-3.5" /> {t('designer.tabs.add_group')}
        </button>
        <button onClick={() => addContainer('ACCORDION')} className="btn-secondary text-xs flex-1">
          <Plus className="w-3.5 h-3.5" /> {t('designer.tabs.add_accordion')}
        </button>
      </div>
    </div>
  )
}
