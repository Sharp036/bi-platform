import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonConfig } from '@/api/controls'
import { exportApi } from '@/api/export'
import {
  ArrowRight, Eye, EyeOff, Filter, Download, ExternalLink, MousePointerClick
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const iconMap: Record<string, typeof ArrowRight> = {
  navigate: ArrowRight,
  show_hide: Eye,
  filter: Filter,
  export: Download,
  url: ExternalLink,
}

const sizeClasses: Record<string, string> = {
  small: 'px-3 py-1.5 text-xs',
  medium: 'px-4 py-2 text-sm',
  large: 'px-6 py-3 text-base',
}

interface ButtonWidgetProps {
  config: ButtonConfig
  reportId: number
  onToggleWidgets?: (widgetIds: number[]) => void
  onApplyFilter?: (field: string, value: string) => void
}

export default function ButtonWidget({
  config, reportId, onToggleWidgets, onApplyFilter
}: ButtonWidgetProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleClick = () => {
    switch (config.buttonType) {
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

  const Icon = iconMap[config.buttonType?.toLowerCase()] || MousePointerClick
  const size = sizeClasses[config.size || 'medium'] || sizeClasses.medium

  return (
    <div className="h-full flex items-center justify-center p-2">
      <button
        onClick={handleClick}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg font-medium transition-all',
          'shadow-sm hover:shadow-md active:scale-[0.98]',
          size
        )}
        style={{
          backgroundColor: config.color || '#3b82f6',
          color: '#ffffff',
        }}
      >
        <Icon className="w-4 h-4" />
        {config.label || t('interactive.button.default_label')}
      </button>
    </div>
  )
}
