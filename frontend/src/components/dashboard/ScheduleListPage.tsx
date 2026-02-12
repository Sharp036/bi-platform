import { useEffect, useState } from 'react'
import { scheduleApi } from '@/api/reports'
import type { Schedule } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { CalendarClock, Play, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ScheduleListPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    scheduleApi.list().then(setSchedules).catch(() => toast.error('Failed to load')).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleToggle = async (id: number) => {
    try { await scheduleApi.toggle(id); load() }
    catch { toast.error('Failed to toggle') }
  }

  const handleRunNow = async (id: number) => {
    try {
      const res = await scheduleApi.executeNow(id)
      toast.success(`Executed: ${res.status} (${res.executionMs}ms)`)
      load()
    } catch { toast.error('Execution failed') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete schedule?')) return
    try { await scheduleApi.delete(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-[900px] mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Schedules</h1>

      {schedules.length === 0 ? (
        <EmptyState icon={<CalendarClock className="w-12 h-12" />} title="No schedules" description="Create report schedules from the report viewer" />
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <div key={s.id} className="card p-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-white">{s.reportName || `Report #${s.reportId}`}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <code className="bg-surface-100 dark:bg-dark-surface-100 px-1.5 py-0.5 rounded">{s.cronExpression}</code>
                  <span>{s.outputFormat}</span>
                  {s.lastRunAt && <span>Last: {new Date(s.lastRunAt).toLocaleString()}</span>}
                  {s.lastStatus && (
                    <span className={s.lastStatus === 'SUCCESS' ? 'text-emerald-600' : 'text-red-600'}>{s.lastStatus}</span>
                  )}
                </div>
                {s.lastError && <p className="text-xs text-red-500 mt-1">{s.lastError}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggle(s.id)} className="btn-ghost p-2">
                  {s.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                </button>
                <button onClick={() => handleRunNow(s.id)} className="btn-ghost p-2"><Play className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(s.id)} className="btn-ghost p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
