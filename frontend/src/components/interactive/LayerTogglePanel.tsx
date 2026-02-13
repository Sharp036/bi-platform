import { Eye, EyeOff, GripVertical } from 'lucide-react'
import type { ChartLayerItem } from '@/types'
import clsx from 'clsx'

interface Props {
  layers: ChartLayerItem[]
  onToggle: (layerId: number, visible: boolean) => void
  compact?: boolean
}

export default function LayerTogglePanel({ layers, onToggle, compact = false }: Props) {
  if (layers.length === 0) return null

  return (
    <div className={clsx(
      'flex gap-1',
      compact ? 'flex-row flex-wrap' : 'flex-col'
    )}>
      {layers.map(layer => (
        <button
          key={layer.id}
          onClick={() => onToggle(layer.id, !layer.isVisible)}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all',
            'hover:bg-surface-100 dark:hover:bg-dark-surface-100',
            layer.isVisible
              ? 'text-slate-700 dark:text-slate-300'
              : 'text-slate-400 dark:text-slate-500 opacity-60'
          )}
          title={layer.isVisible ? `Hide "${layer.label || layer.name}"` : `Show "${layer.label || layer.name}"`}
        >
          {/* Color indicator */}
          {layer.color && (
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: layer.color, opacity: layer.isVisible ? 1 : 0.3 }}
            />
          )}

          {!compact && <GripVertical className="w-3 h-3 text-slate-300" />}

          {/* Eye icon */}
          {layer.isVisible
            ? <Eye className="w-3.5 h-3.5 text-brand-500" />
            : <EyeOff className="w-3.5 h-3.5" />}

          {/* Layer name */}
          <span className={clsx(
            'truncate max-w-[100px]',
            !layer.isVisible && 'line-through'
          )}>
            {layer.label || layer.name}
          </span>

          {/* Chart type badge */}
          <span className="text-[10px] text-slate-400 uppercase">
            {layer.chartType}
          </span>
        </button>
      ))}
    </div>
  )
}
