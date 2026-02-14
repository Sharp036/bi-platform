import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { controlsApi, GlobalFilterConfig } from '@/api/controls'
import { Filter, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Widget } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  reportId: number
  widgets: Widget[]
}

export default function GlobalFilterConfigPanel({ reportId, widgets }: Props) {
  const { t } = useTranslation()
  const [configs, setConfigs] = useState<GlobalFilterConfig[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    controlsApi.getFilters(reportId)
      .then(setConfigs)
      .catch(() => toast.error(t('interactive.filter.failed_load')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [reportId])

  const toggleSource = async (widgetId: number) => {
    const existing = configs.find(c => c.widgetId === widgetId)
    if (existing) {
      try {
        await controlsApi.saveFilter({
          reportId,
          widgetId,
          isFilterSource: !existing.isFilterSource,
          filterField: existing.filterField || undefined,
          excludedTargets: existing.excludedTargets || undefined,
          isEnabled: existing.isEnabled,
        })
        load()
      } catch {
        toast.error(t('common.failed_to_update'))
      }
    } else {
      try {
        await controlsApi.saveFilter({
          reportId,
          widgetId,
          isFilterSource: true,
          isEnabled: true,
        })
        load()
      } catch {
        toast.error(t('common.failed_to_create'))
      }
    }
  }

  const updateField = async (widgetId: number, field: string) => {
    const existing = configs.find(c => c.widgetId === widgetId)
    if (!existing) return
    try {
      await controlsApi.saveFilter({
        reportId,
        widgetId,
        isFilterSource: existing.isFilterSource,
        filterField: field || undefined,
        excludedTargets: existing.excludedTargets || undefined,
        isEnabled: existing.isEnabled,
      })
      load()
    } catch {
      toast.error(t('common.failed_to_update'))
    }
  }

  const updateExcluded = async (widgetId: number, excluded: string) => {
    const existing = configs.find(c => c.widgetId === widgetId)
    if (!existing) return
    try {
      await controlsApi.saveFilter({
        reportId,
        widgetId,
        isFilterSource: existing.isFilterSource,
        filterField: existing.filterField || undefined,
        excludedTargets: excluded || undefined,
        isEnabled: existing.isEnabled,
      })
      load()
    } catch {
      toast.error(t('common.failed_to_update'))
    }
  }

  const remove = async (widgetId: number) => {
    try {
      await controlsApi.deleteFilter(reportId, widgetId)
      load()
    } catch {
      toast.error(t('common.failed_to_delete'))
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
        <Filter className="w-4 h-4 text-brand-500" /> {t('interactive.filter.config_title')}
      </h3>

      <div className="space-y-2">
        {widgets.map(w => {
          const config = configs.find(c => c.widgetId === w.widgetId)
          const isSource = config?.isFilterSource ?? false

          return (
            <div key={w.widgetId}
              className="card p-3 flex items-center gap-3 text-sm">
              <button onClick={() => toggleSource(w.widgetId)}
                className="flex-shrink-0">
                {isSource
                  ? <ToggleRight className="w-5 h-5 text-brand-500" />
                  : <ToggleLeft className="w-5 h-5 text-slate-300 dark:text-slate-600" />}
              </button>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                  {w.title || `Widget #${w.widgetId}`}
                </p>
                <p className="text-xs text-slate-400">{w.widgetType}</p>
              </div>

              {isSource && config && (
                <>
                  <input
                    value={config.filterField || ''}
                    onChange={e => updateField(w.widgetId, e.target.value)}
                    placeholder={t('interactive.filter.field_placeholder')}
                    className="input text-xs w-32 py-1"
                  />
                  <input
                    value={config.excludedTargets || ''}
                    onChange={e => updateExcluded(w.widgetId, e.target.value)}
                    placeholder={t('interactive.filter.exclude_placeholder')}
                    className="input text-xs w-28 py-1"
                    title={t('interactive.filter.exclude_tooltip')}
                  />
                  <button onClick={() => remove(w.widgetId)}
                    className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
