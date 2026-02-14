import { Radio, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LiveStatus } from '@/hooks/useLiveData'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface LiveIndicatorProps {
  status: LiveStatus
  lastUpdate: number | null
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onReconnect?: () => void
}

const STATUS_CONFIG: Record<LiveStatus, { color: string; labelKey: string; icon: typeof Radio }> = {
  connected:    { color: 'text-emerald-500', labelKey: 'live.connected',    icon: Radio },
  connecting:   { color: 'text-amber-500',   labelKey: 'live.connecting',   icon: Loader2 },
  disconnected: { color: 'text-slate-400',   labelKey: 'live.disconnected', icon: WifiOff },
  error:        { color: 'text-red-500',     labelKey: 'live.error',        icon: WifiOff },
}

export default function LiveIndicator({ status, lastUpdate, enabled, onToggle, onReconnect }: LiveIndicatorProps) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const isAnimating = status === 'connecting'
  const isLive = status === 'connected'

  return (
    <div className="flex items-center gap-2">
      {/* Toggle */}
      <button
        onClick={() => onToggle(!enabled)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          enabled
            ? isLive
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800'
            : 'bg-surface-100 dark:bg-dark-surface-100 text-slate-500 dark:text-slate-400'
        }`}
        title={enabled ? `${t(config.labelKey)}${lastUpdate ? ` · ${t('live.last_update', { time: dayjs(lastUpdate).fromNow() })}` : ''}` : t('live.enable')}
      >
        <Icon className={`w-3.5 h-3.5 ${config.color} ${isAnimating ? 'animate-spin' : ''} ${isLive ? 'animate-pulse' : ''}`} />
        {enabled ? t(config.labelKey) : t('live.connected')}
      </button>

      {/* Reconnect button on error */}
      {enabled && status === 'error' && onReconnect && (
        <button onClick={onReconnect} className="btn-ghost text-xs p-1" title={t('live.reconnect')}>
          <Wifi className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Last update time */}
      {enabled && lastUpdate && (
        <span className="text-xs text-slate-400" title={new Date(lastUpdate).toLocaleTimeString()}>
          {dayjs(lastUpdate).fromNow()}
        </span>
      )}
    </div>
  )
}
