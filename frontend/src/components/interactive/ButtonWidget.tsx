import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonConfig, controlsApi } from '@/api/controls'
import { exportApi } from '@/api/export'
import {
  ArrowRight, Eye, EyeOff, Filter, Download, ExternalLink, MousePointerClick, Play, Loader2
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

interface ButtonWidgetProps {
  config: ButtonConfig
  reportId: number
  widgetId?: number
  // Applied parameter values of the report, sent by RUN_JOB buttons
  reportParams?: Record<string, unknown>
  onToggleWidgets?: (widgetIds: number[]) => void
  onApplyFilter?: (field: string, value: string) => void
}

export default function ButtonWidget({
  config, reportId, widgetId, reportParams, onToggleWidgets, onApplyFilter
}: ButtonWidgetProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [toggled, setToggled] = useState(false)
  const [running, setRunning] = useState(false)

  const runJob = () => {
    if (running) return
    if (!reportId || !widgetId) {
      toast.error(t('interactive.button.run_job_unavailable'))
      return
    }
    if (!window.confirm(config.confirmText || t('interactive.button.run_job_confirm'))) return
    setRunning(true)
    controlsApi.runJob(reportId, widgetId, reportParams || {})
      .then(res => toast.success(t('interactive.button.run_job_started', { runId: res.runId }), { duration: 8000 }))
      .catch(e => toast.error(e?.response?.data?.message || t('interactive.button.run_job_failed'), { duration: 10000 }))
      .finally(() => setRunning(false))
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

  const Icon = running ? Loader2 : (iconMap[(config.buttonType || 'show_hide').toLowerCase()] || MousePointerClick)
  const size = sizeClasses[config.size || 'medium'] || sizeClasses.medium
  const colorClasses: Record<string, string> = {
    brand: 'bg-brand-500 hover:bg-brand-600 text-white',
    green: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    red: 'bg-red-500 hover:bg-red-600 text-white',
    orange: 'bg-amber-500 hover:bg-amber-600 text-white',
    slate: 'bg-slate-500 hover:bg-slate-600 text-white',
  }
  const colorClass = colorClasses[config.color || 'brand'] || colorClasses.brand

  return (
    <div className="h-full flex items-center justify-center">
      <button
        onClick={handleClick}
        disabled={running}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg font-medium transition-all',
          'shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait',
          size,
          colorClass
        )}
      >
        <Icon className={clsx('w-4 h-4', running && 'animate-spin')} />
        {toggled && config.labelActive ? config.labelActive : (config.label || t('interactive.button.default_label'))}
      </button>
    </div>
  )
}
