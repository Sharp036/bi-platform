import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonConfig, JobStatusResponse, controlsApi } from '@/api/controls'
import { exportApi } from '@/api/export'
import {
  ArrowRight, Eye, Filter, Download, ExternalLink, MousePointerClick, Play, Loader2
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const iconMap: Record<string, typeof ArrowRight> = {
  navigate: ArrowRight,
  show_hide: Eye,
  filter: Filter,
  export: Download,
  url: ExternalLink,
  run_job: Play,
}

const sizeClasses: Record<string, string> = {
  small: 'px-3 py-1.5 text-xs',
  medium: 'px-4 py-2 text-sm',
  large: 'px-6 py-3 text-base',
}

// RUN_JOB progress: the run state is asked every POLL_MS; polling stops after MAX_POLL_ERRORS failures in a row.
const POLL_MS = 5000
const MAX_POLL_ERRORS = 5

interface JobProgress {
  runId: string
  startedAt: number
  status?: JobStatusResponse
  pollErrors: number
}

interface ButtonWidgetProps {
  config: ButtonConfig
  reportId: number
  widgetId?: number
  // Applied parameter values of the report, sent by RUN_JOB buttons
  reportParams?: Record<string, unknown>
  // Called when a job started by a RUN_JOB button is over, to refresh the report
  onJobFinished?: () => void
  onToggleWidgets?: (widgetIds: number[]) => void
  onApplyFilter?: (field: string, value: string) => void
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function parseTime(value?: string | null): number | undefined {
  if (!value) return undefined
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? undefined : ms
}

export default function ButtonWidget({
  config, reportId, widgetId, reportParams, onJobFinished, onToggleWidgets, onApplyFilter
}: ButtonWidgetProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [toggled, setToggled] = useState(false)
  const [starting, setStarting] = useState(false)
  const [job, setJob] = useState<JobProgress | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const finishedRunRef = useRef<string | null>(null)
  const onJobFinishedRef = useRef(onJobFinished)
  onJobFinishedRef.current = onJobFinished

  const jobActive = !!job && !job.status?.finished && job.pollErrors < MAX_POLL_ERRORS

  // Poll the run state while the job is active.
  useEffect(() => {
    if (!job || !widgetId || !jobActive) return
    const runId = job.runId
    let cancelled = false
    const poll = () => {
      controlsApi.getJobStatus(reportId, widgetId, runId)
        .then(status => {
          if (cancelled) return
          setJob(j => (j && j.runId === runId ? { ...j, status, pollErrors: 0 } : j))
          if (status.finished && finishedRunRef.current !== runId) {
            finishedRunRef.current = runId
            if (status.succeeded) toast.success(t('interactive.button.job_done_toast'), { duration: 8000 })
            else toast.error(t('interactive.button.job_failed_toast', { task: status.failedTask || '-' }), { duration: 10000 })
            onJobFinishedRef.current?.()
          }
        })
        .catch(() => {
          if (cancelled) return
          setJob(j => (j && j.runId === runId ? { ...j, pollErrors: j.pollErrors + 1 } : j))
        })
    }
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [job?.runId, jobActive, reportId, widgetId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick the elapsed time once a second while the job is active.
  useEffect(() => {
    if (!jobActive) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [jobActive])

  const runJob = () => {
    if (starting || jobActive) return
    if (!reportId || !widgetId) {
      toast.error(t('interactive.button.run_job_unavailable'))
      return
    }
    if (!window.confirm(config.confirmText || t('interactive.button.run_job_confirm'))) return
    setStarting(true)
    controlsApi.runJob(reportId, widgetId, reportParams || {})
      .then(res => {
        toast.success(t('interactive.button.run_job_started', { runId: res.runId }), { duration: 8000 })
        setNow(Date.now())
        setJob({ runId: res.runId, startedAt: Date.now(), pollErrors: 0 })
      })
      .catch(e => toast.error(e?.response?.data?.message || t('interactive.button.run_job_failed'), { duration: 10000 }))
      .finally(() => setStarting(false))
  }

  const handleClick = () => {
    const btnType = config.buttonType || 'SHOW_HIDE'
    if (btnType === 'SHOW_HIDE') setToggled(v => !v)
    switch (btnType) {
      case 'NAVIGATE':
        if (config.targetReportId) {
          const params = config.targetParams
            ? '?' + new URLSearchParams(config.targetParams).toString()
            : ''
          navigate(`/reports/${config.targetReportId}${params}`)
        }
        break

      case 'SHOW_HIDE':
        if (config.toggleWidgetIds && onToggleWidgets) {
          onToggleWidgets(config.toggleWidgetIds)
        }
        break

      case 'FILTER':
        if (config.filterField && config.filterValue && onApplyFilter) {
          onApplyFilter(config.filterField, config.filterValue)
        }
        break

      case 'EXPORT':
        if (config.exportFormat) {
          exportApi.exportAndSave(reportId, config.exportFormat)
            .then(() => toast.success(t('interactive.button.export_started', { format: config.exportFormat })))
            .catch(() => toast.error(t('interactive.button.export_failed')))
        }
        break

      case 'RUN_JOB':
        runJob()
        break

      case 'URL':
        if (config.url) {
          if (config.openInNewTab !== false) {
            window.open(config.url, '_blank', 'noopener')
          } else {
            window.location.href = config.url
          }
        }
        break
    }
  }

  const busy = starting || jobActive
  const Icon = busy ? Loader2 : (iconMap[(config.buttonType || 'show_hide').toLowerCase()] || MousePointerClick)
  const size = sizeClasses[config.size || 'medium'] || sizeClasses.medium
  const colorClasses: Record<string, string> = {
    brand: 'bg-brand-500 hover:bg-brand-600 text-white',
    green: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    red: 'bg-red-500 hover:bg-red-600 text-white',
    orange: 'bg-amber-500 hover:bg-amber-600 text-white',
    slate: 'bg-slate-500 hover:bg-slate-600 text-white',
  }
  const colorClass = colorClasses[config.color || 'brand'] || colorClasses.brand

  // Progress line of the last job run: steps done, current step, elapsed time.
  let progress: { percent: number; text: string; tone: 'run' | 'ok' | 'fail' | 'warn'; elapsed: string } | null = null
  if (job) {
    const st = job.status
    const begin = parseTime(st?.startDate) ?? parseTime(st?.queuedAt) ?? job.startedAt
    const end = st?.finished ? (parseTime(st?.endDate) ?? now) : now
    const elapsed = formatElapsed(end - begin)
    if (job.pollErrors >= MAX_POLL_ERRORS) {
      progress = { percent: 0, text: t('interactive.button.job_status_unavailable'), tone: 'warn', elapsed }
    } else if (!st || st.state === 'queued') {
      progress = { percent: 0, text: t('interactive.button.job_queued'), tone: 'run', elapsed }
    } else if (st.finished) {
      progress = st.succeeded
        ? { percent: 100, text: t('interactive.button.job_done'), tone: 'ok', elapsed }
        : { percent: 100, text: t('interactive.button.job_failed_step', { task: st.failedTask || '-' }), tone: 'fail', elapsed }
    } else {
      const percent = st.totalTasks > 0 ? Math.round((st.doneTasks / st.totalTasks) * 100) : 0
      progress = {
        percent,
        text: t('interactive.button.job_step', { done: st.doneTasks, total: st.totalTasks, task: st.currentTask || '-' }),
        tone: 'run',
        elapsed,
      }
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-1.5">
      <button
        onClick={handleClick}
        disabled={busy}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg font-medium transition-all',
          'shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait',
          size,
          colorClass
        )}
      >
        <Icon className={clsx('w-4 h-4', busy && 'animate-spin')} />
        {toggled && config.labelActive ? config.labelActive : (config.label || t('interactive.button.default_label'))}
      </button>
      {progress && (
        <div className="w-full max-w-xs px-2">
          <div className="h-1.5 w-full rounded-full bg-surface-200 dark:bg-dark-surface-100 overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                progress.tone === 'ok' && 'bg-emerald-500',
                progress.tone === 'fail' && 'bg-red-500',
                progress.tone === 'warn' && 'bg-amber-500',
                progress.tone === 'run' && 'bg-brand-500'
              )}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between gap-2 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
            <span className="truncate" title={progress.text}>{progress.text}</span>
            <span className="tabular-nums whitespace-nowrap">{progress.elapsed}</span>
          </div>
        </div>
      )}
    </div>
  )
}
