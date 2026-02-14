import { Radio, Wifi, WifiOff, Loader2 } from 'lucide-react'
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

const STATUS_CONFIG: Record<LiveStatus, { color: string; label: string; icon: typeof Radio }> = {
  connected:    { color: 'text-emerald-500', label: 'Live',         icon: Radio },
  connecting:   { color: 'text-amber-500',   label: 'Connecting',   icon: Loader2 },
  disconnected: { color: 'text-slate-400',   label: 'Disconnected', icon: WifiOff },
  error:        { color: 'text-red-500',     label: 'Error',        icon: WifiOff },
}

export default function LiveIndicator({ status, lastUpdate, enabled, onToggle, onReconnect }: LiveIndicatorProps) {
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
        title={enabled ? `${config.label}${lastUpdate ? ` · Last: ${dayjs(lastUpdate).fromNow()}` : ''}` : 'Enable live updates'}
      >
        <Icon className={`w-3.5 h-3.5 ${config.color} ${isAnimating ? 'animate-spin' : ''} ${isLive ? 'animate-pulse' : ''}`} />
        {enabled ? config.label : 'Live'}
      </button>

      {/* Reconnect button on error */}
      {enabled && status === 'error' && onReconnect && (
        <button onClick={onReconnect} className="btn-ghost text-xs p-1" title="Reconnect">
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
