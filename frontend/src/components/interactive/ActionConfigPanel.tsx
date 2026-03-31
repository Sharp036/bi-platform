import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Zap, Filter, Pointer, Navigation, ExternalLink, Layers, Pencil } from 'lucide-react'
import type { DashboardActionItem, DashboardActionRequest, WidgetListItem } from '@/types'
import { interactiveApi } from '@/api/interactive'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  reportId: number
  widgets: WidgetListItem[]
}

const actionTypeIcons: Record<string, typeof Filter> = {
  FILTER: Filter,
  HIGHLIGHT: Pointer,
  NAVIGATE: Navigation,
  URL: ExternalLink,
  DRILL_REPLACE: Layers,
}

const triggerTypes = ['CLICK', 'HOVER', 'SELECT']

export default function ActionConfigPanel({ reportId, widgets }: Props) {
  const { t } = useTranslation()

  const actionTypeConfig = [
    { type: 'FILTER', icon: Filter, label: t('interactive.action.cross_filter'), desc: t('interactive.action.cross_filter_desc') },
    { type: 'HIGHLIGHT', icon: Pointer, label: t('interactive.action.highlight'), desc: t('interactive.action.highlight_desc') },
    { type: 'NAVIGATE', icon: Navigation, label: t('interactive.action.navigate'), desc: t('interactive.action.navigate_desc') },
    { type: 'URL', icon: ExternalLink, label: t('interactive.action.open_url'), desc: t('interactive.action.open_url_desc') },
    { type: 'DRILL_REPLACE', icon: Layers, label: t('interactive.action.drill_replace'), desc: t('interactive.action.drill_replace_desc') },
  ]

  const [actions, setActions] = useState<DashboardActionItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<DashboardActionRequest>>({
    reportId, actionType: 'FILTER', triggerType: 'CLICK',
  })

  useEffect(() => {
    interactiveApi.getActionsForReport(reportId).then(setActions).catch(() => {})
  }, [reportId])

  const buildRequest = (): DashboardActionRequest => ({
    reportId,
    name: form.name || '',
    actionType: form.actionType || 'FILTER',
    triggerType: form.triggerType || 'CLICK',
    sourceWidgetId: form.sourceWidgetId || undefined,
    targetWidgetIds: form.targetWidgetIds || undefined,
    sourceField: form.sourceField || undefined,
    targetField: form.targetField || undefined,
    targetReportId: form.targetReportId || undefined,
    urlTemplate: form.urlTemplate || undefined,
    config: {},
  })

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error(t('interactive.action.name_required')); return }
    try {
      if (editingId) {
        const updated = await interactiveApi.updateAction(editingId, buildRequest())
        setActions(prev => prev.map(a => a.id === editingId ? updated : a))
        setEditingId(null)
        toast.success(t('interactive.action.updated'))
      } else {
        const created = await interactiveApi.createAction(buildRequest())
        setActions(prev => [...prev, created])
        toast.success(t('interactive.action.created'))
      }
      setShowAdd(false)
    } catch { toast.error(editingId ? t('interactive.action.failed_update') : t('interactive.action.failed_create')) }
  }

  const handleEdit = (action: DashboardActionItem) => {
    setForm({
      reportId,
      name: action.name,
      actionType: action.actionType,
      triggerType: action.triggerType,
      sourceWidgetId: action.sourceWidgetId,
      targetWidgetIds: action.targetWidgetIds || undefined,
      sourceField: action.sourceField || undefined,
      targetField: action.targetField || undefined,
      targetReportId: action.targetReportId || undefined,
      urlTemplate: action.urlTemplate || undefined,
    })
    setEditingId(action.id)
    setShowAdd(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await interactiveApi.deleteAction(id)
      setActions(prev => prev.filter(a => a.id !== id))
      toast.success(t('interactive.action.deleted'))
    } catch { toast.error(t('interactive.action.failed_delete')) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500" />
          {t('interactive.action.title')}
        </h3>
        <button onClick={() => {
          setShowAdd(!showAdd)
          setEditingId(null)
          setForm({ reportId, actionType: 'FILTER', triggerType: 'CLICK' })
        }} className="btn-ghost p-1">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Existing actions */}
      {actions.map(action => {
        const cfg = actionTypeConfig.find(c => c.type === action.actionType)
        const Icon = cfg?.icon || Zap
        const sourceWidget = widgets.find(w => w.id === action.sourceWidgetId)

        return (
          <div key={action.id} className="flex items-center gap-2 p-2 bg-surface-50 dark:bg-dark-surface-100 rounded-lg text-xs">
            <Icon className="w-4 h-4 text-brand-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-700 dark:text-slate-300 truncate">{action.name}</div>
              <div className="text-slate-400">
                {sourceWidget?.title || `Widget #${action.sourceWidgetId}`}
                {' → '}
                {action.targetWidgetIds === '*'
                  ? t('common.all')
                  : (action.targetWidgetIds || '').split(',').map(id => {
                      const tw = widgets.find(w => w.id === Number(id.trim()))
                      return tw?.title || `#${id.trim()}`
                    }).join(', ')
                }
                {' '}{t('common.on')}{' '}{action.triggerType.toLowerCase()}
              </div>
            </div>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded font-medium',
              action.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}>
              {action.actionType}
            </span>
            <button onClick={() => handleEdit(action)} className="text-slate-400 hover:text-brand-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(action.id)} className="text-red-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}

      {actions.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400 text-center py-2">{t('interactive.action.no_actions')}</p>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface-50 dark:bg-dark-surface-100 rounded-lg p-3 space-y-3 border border-surface-200 dark:border-dark-surface-100">
          <input
            value={form.name || ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={t('interactive.action.action_name')}
            className="input text-xs w-full"
          />

          {/* Action type */}
          <div className="grid grid-cols-2 gap-2">
            {actionTypeConfig.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setForm(f => ({ ...f, actionType: type }))}
                className={clsx(
                  'flex items-center gap-2 p-2 rounded border text-xs',
                  form.actionType === type
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-surface-200 dark:border-dark-surface-100'
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Trigger */}
          <div className="flex gap-2">
            {triggerTypes.map(trigger => (
              <button
                key={trigger}
                onClick={() => setForm(f => ({ ...f, triggerType: trigger }))}
                className={clsx(
                  'px-3 py-1 rounded text-xs border',
                  form.triggerType === trigger
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                    : 'border-surface-200 dark:border-dark-surface-100 text-slate-500'
                )}
              >
                {trigger.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Source widget */}
          <select
            value={form.sourceWidgetId || ''}
            onChange={e => setForm(f => ({ ...f, sourceWidgetId: Number(e.target.value) || undefined }))}
            className="input text-xs w-full"
          >
            <option value="">{t('interactive.action.source_widget')}</option>
            {widgets.map(w => (
              <option key={w.id} value={w.id}>{w.title || `Widget #${w.id}`} ({w.widgetType})</option>
            ))}
          </select>

          {/* Target */}
          {(form.actionType === 'FILTER' || form.actionType === 'HIGHLIGHT' || form.actionType === 'DRILL_REPLACE') && (
            <>
              {form.actionType === 'DRILL_REPLACE' ? (
                <select
                  value={form.targetWidgetIds || ''}
                  onChange={e => setForm(f => ({ ...f, targetWidgetIds: e.target.value }))}
                  className="input text-xs w-full"
                >
                  <option value="">{t('interactive.action.target_widget')}</option>
                  {widgets.filter(w => w.id !== form.sourceWidgetId).map(w => (
                    <option key={w.id} value={String(w.id)}>
                      {w.title || `Widget #${w.id}`} ({w.widgetType})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.targetWidgetIds || ''}
                  onChange={e => setForm(f => ({ ...f, targetWidgetIds: e.target.value }))}
                  placeholder={t('interactive.action.target_widgets')}
                  className="input text-xs w-full"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.sourceField || ''}
                  onChange={e => setForm(f => ({ ...f, sourceField: e.target.value }))}
                  placeholder={t('interactive.action.source_field')}
                  className="input text-xs"
                />
                <input
                  value={form.targetField || ''}
                  onChange={e => setForm(f => ({ ...f, targetField: e.target.value }))}
                  placeholder={t('interactive.action.target_field')}
                  className="input text-xs"
                />
              </div>
            </>
          )}

          {form.actionType === 'NAVIGATE' && (
            <input
              type="number"
              value={form.targetReportId || ''}
              onChange={e => setForm(f => ({ ...f, targetReportId: Number(e.target.value) || undefined }))}
              placeholder={t('interactive.action.target_report')}
              className="input text-xs w-full"
            />
          )}

          {form.actionType === 'URL' && (
            <input
              value={form.urlTemplate || ''}
              onChange={e => setForm(f => ({ ...f, urlTemplate: e.target.value }))}
              placeholder={t('interactive.action.url_template_placeholder')}
              className="input text-xs w-full"
            />
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setEditingId(null) }} className="btn-secondary text-xs">{t('common.cancel')}</button>
            <button onClick={handleSave} className="btn-primary text-xs">{editingId ? t('common.save') : t('common.create')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
