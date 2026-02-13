import { useState, useEffect } from 'react'
import { Plus, Trash2, Zap, Filter, Pointer, Navigation, ExternalLink } from 'lucide-react'
import type { DashboardActionItem, DashboardActionRequest, WidgetListItem } from '@/types'
import { interactiveApi } from '@/api/interactive'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  reportId: number
  widgets: WidgetListItem[]
}

const actionTypeConfig = [
  { type: 'FILTER', icon: Filter, label: 'Cross-Filter', desc: 'Filter other widgets on click' },
  { type: 'HIGHLIGHT', icon: Pointer, label: 'Highlight', desc: 'Highlight related data' },
  { type: 'NAVIGATE', icon: Navigation, label: 'Navigate', desc: 'Go to another report' },
  { type: 'URL', icon: ExternalLink, label: 'Open URL', desc: 'Open a web page' },
]

const triggerTypes = ['CLICK', 'HOVER', 'SELECT']

export default function ActionConfigPanel({ reportId, widgets }: Props) {
  const [actions, setActions] = useState<DashboardActionItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<Partial<DashboardActionRequest>>({
    reportId, actionType: 'FILTER', triggerType: 'CLICK',
  })

  useEffect(() => {
    interactiveApi.getActionsForReport(reportId).then(setActions).catch(() => {})
  }, [reportId])

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Name is required'); return }
    try {
      const req: DashboardActionRequest = {
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
      }
      const created = await interactiveApi.createAction(req)
      setActions(prev => [...prev, created])
      setShowAdd(false)
      toast.success('Action created')
    } catch { toast.error('Failed to create action') }
  }

  const handleDelete = async (id: number) => {
    try {
      await interactiveApi.deleteAction(id)
      setActions(prev => prev.filter(a => a.id !== id))
      toast.success('Action deleted')
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500" />
          Dashboard Actions
        </h3>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-ghost p-1">
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
                {action.targetWidgetIds === '*' ? 'All' : action.targetWidgetIds}
                {' on '}{action.triggerType.toLowerCase()}
              </div>
            </div>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded font-medium',
              action.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}>
              {action.actionType}
            </span>
            <button onClick={() => handleDelete(action.id)} className="text-red-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}

      {actions.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400 text-center py-2">No actions configured</p>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface-50 dark:bg-dark-surface-100 rounded-lg p-3 space-y-3 border border-surface-200 dark:border-dark-surface-100">
          <input
            value={form.name || ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Action name"
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
            {triggerTypes.map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, triggerType: t }))}
                className={clsx(
                  'px-3 py-1 rounded text-xs border',
                  form.triggerType === t
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                    : 'border-surface-200 dark:border-dark-surface-100 text-slate-500'
                )}
              >
                {t.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Source widget */}
          <select
            value={form.sourceWidgetId || ''}
            onChange={e => setForm(f => ({ ...f, sourceWidgetId: Number(e.target.value) || undefined }))}
            className="input text-xs w-full"
          >
            <option value="">Source widget...</option>
            {widgets.map(w => (
              <option key={w.id} value={w.id}>{w.title || `Widget #${w.id}`} ({w.widgetType})</option>
            ))}
          </select>

          {/* Target */}
          {(form.actionType === 'FILTER' || form.actionType === 'HIGHLIGHT') && (
            <>
              <input
                value={form.targetWidgetIds || ''}
                onChange={e => setForm(f => ({ ...f, targetWidgetIds: e.target.value }))}
                placeholder="Target widget IDs (e.g. 2,3 or * for all)"
                className="input text-xs w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.sourceField || ''}
                  onChange={e => setForm(f => ({ ...f, sourceField: e.target.value }))}
                  placeholder="Source field"
                  className="input text-xs"
                />
                <input
                  value={form.targetField || ''}
                  onChange={e => setForm(f => ({ ...f, targetField: e.target.value }))}
                  placeholder="Target field"
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
              placeholder="Target Report ID"
              className="input text-xs w-full"
            />
          )}

          {form.actionType === 'URL' && (
            <input
              value={form.urlTemplate || ''}
              onChange={e => setForm(f => ({ ...f, urlTemplate: e.target.value }))}
              placeholder="https://example.com/detail?id={customer_id}"
              className="input text-xs w-full"
            />
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={handleSave} className="btn-primary text-xs">Create</button>
          </div>
        </div>
      )}
    </div>
  )
}
