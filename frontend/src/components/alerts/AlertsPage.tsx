import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { alertApi } from '@/api/advanced'
import type { DataAlert, AlertCheckResult } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Bell, Plus, Play, Trash2, CheckCircle, AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'

const OPERATORS = ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ', 'BETWEEN']
const OP_LABELS: Record<string, string> = {
  GT: '>', GTE: '≥', LT: '<', LTE: '≤', EQ: '=', NEQ: '≠', BETWEEN: 'between'
}

export default function AlertsPage() {
  const { t } = useTranslation()
  const [alerts, setAlerts] = useState<DataAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [checkResults, setCheckResults] = useState<Record<number, AlertCheckResult>>({})

  // Create form
  const [form, setForm] = useState({
    name: '', reportId: '', widgetId: '', fieldName: '',
    operator: 'GT', thresholdValue: '', checkIntervalMin: '60'
  })

  const load = () => {
    setLoading(true)
    alertApi.listActive()
      .then(setAlerts)
      .catch(() => toast.error(t('common.failed_to_load')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (!form.name || !form.reportId || !form.fieldName) {
      toast.error(t('alerts.required_fields'))
      return
    }
    try {
      await alertApi.create({
        name: form.name,
        reportId: Number(form.reportId),
        widgetId: form.widgetId ? Number(form.widgetId) : undefined,
        fieldName: form.fieldName,
        operator: form.operator as DataAlert['operator'],
        thresholdValue: Number(form.thresholdValue),
        checkIntervalMin: Number(form.checkIntervalMin),
      })
      toast.success(t('alerts.created'))
      setShowCreate(false)
      setForm({ name: '', reportId: '', widgetId: '', fieldName: '', operator: 'GT', thresholdValue: '', checkIntervalMin: '60' })
      load()
    } catch { toast.error(t('alerts.create_failed')) }
  }

  const handleCheck = async (id: number) => {
    try {
      const result = await alertApi.check(id)
      setCheckResults(prev => ({ ...prev, [id]: result }))
      toast.success(result.triggered ? `⚠ ${t('alerts.triggered')}!` : `✓ ${t('alerts.ok')}`)
    } catch { toast.error(t('common.operation_failed')) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('alerts.delete_confirm'))) return
    try {
      await alertApi.delete(id)
      toast.success(t('common.deleted'))
      load()
    } catch { toast.error(t('common.failed_to_delete')) }
  }

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('alerts.title')}</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> {t('alerts.new_alert')}
        </button>
      </div>

      {loading ? <LoadingSpinner /> : alerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-12 h-12" />}
          title={t('alerts.no_alerts')}
          description={t('alerts.description')}
          action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> {t('alerts.create_alert')}</button>}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const result = checkResults[alert.id]
            return (
              <div key={alert.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className={`w-4 h-4 ${alert.consecutiveTriggers > 0 ? 'text-red-500' : 'text-slate-400'}`} />
                      <h3 className="font-semibold text-slate-800 dark:text-white">{alert.name}</h3>
                      {alert.consecutiveTriggers > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                          {t('alerts.triggered')} ×{alert.consecutiveTriggers}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Report #{alert.reportId} · <span className="font-mono">{alert.fieldName}</span> {OP_LABELS[alert.operator] || alert.operator} {alert.thresholdValue}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{t('alerts.every_minutes', { interval: alert.checkIntervalMin })}</span>
                      {alert.lastCheckedAt && <span>{t('alerts.last_check')} {new Date(alert.lastCheckedAt).toLocaleString()}</span>}
                      {alert.lastValue != null && <span>{t('alerts.last_value')} {alert.lastValue}</span>}
                    </div>

                    {result && (
                      <div className={`mt-2 text-sm flex items-center gap-1 ${result.triggered ? 'text-red-500' : 'text-emerald-500'}`}>
                        {result.triggered ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        {result.message}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => handleCheck(alert.id)} className="btn-ghost p-2" title="Check now">
                      <Play className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(alert.id)} className="btn-ghost p-2 text-red-500" title={t('common.delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{t('alerts.new_alert')}</h3>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('alerts.alert_name')}</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input text-sm" placeholder="e.g. Revenue drop alert" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('alerts.report_id')}</label>
                  <input type="number" value={form.reportId} onChange={e => setForm({ ...form, reportId: e.target.value })}
                    className="input text-sm" placeholder="1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('alerts.widget_id')}</label>
                  <input type="number" value={form.widgetId} onChange={e => setForm({ ...form, widgetId: e.target.value })}
                    className="input text-sm" placeholder="(any)" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('alerts.field_name')}</label>
                <input value={form.fieldName} onChange={e => setForm({ ...form, fieldName: e.target.value })}
                  className="input text-sm" placeholder="e.g. revenue, row_count" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('alerts.operator')}</label>
                  <select value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })}
                    className="input text-sm">
                    {OPERATORS.map(op => <option key={op} value={op}>{OP_LABELS[op]} ({op})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('alerts.threshold')}</label>
                  <input type="number" value={form.thresholdValue} onChange={e => setForm({ ...form, thresholdValue: e.target.value })}
                    className="input text-sm" placeholder="100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('alerts.check_interval')}</label>
                <input type="number" value={form.checkIntervalMin} onChange={e => setForm({ ...form, checkIntervalMin: e.target.value })}
                  className="input text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">{t('common.cancel')}</button>
              <button onClick={handleCreate} className="btn-primary text-sm">
                <Bell className="w-4 h-4" /> {t('alerts.create_alert')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
