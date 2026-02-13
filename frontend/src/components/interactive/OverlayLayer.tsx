import { useState } from 'react'
import type { OverlayItem } from '@/types'
import { GripHorizontal } from 'lucide-react'

interface Props {
  overlays: OverlayItem[]
  editable?: boolean
  onUpdate?: (id: number, patch: Partial<OverlayItem>) => void
  onDelete?: (id: number) => void
}

export default function OverlayLayer({ overlays, editable = false, onUpdate, onDelete }: Props) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleMouseDown = (id: number, e: React.MouseEvent) => {
    if (!editable) return
    const overlay = overlays.find(o => o.id === id)
    if (!overlay) return
    setDragging(id)
    setDragOffset({ x: e.clientX - overlay.positionX, y: e.clientY - overlay.positionY })
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !onUpdate) return
    onUpdate(dragging, {
      positionX: e.clientX - dragOffset.x,
      positionY: e.clientY - dragOffset.y,
    })
  }

  const handleMouseUp = () => { setDragging(null) }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {overlays.filter(o => o.isVisible).map(overlay => (
        <div
          key={overlay.id}
          className="absolute pointer-events-auto"
          style={{
            left: overlay.positionX,
            top: overlay.positionY,
            width: overlay.width,
            height: overlay.height,
            opacity: overlay.opacity,
            zIndex: overlay.zIndex,
            ...(overlay.style?.borderRadius ? { borderRadius: String(overlay.style.borderRadius) } : {}),
            ...(overlay.style?.border ? { border: String(overlay.style.border) } : {}),
            ...(overlay.style?.boxShadow ? { boxShadow: String(overlay.style.boxShadow) } : {}),
            ...(overlay.style?.background ? { background: String(overlay.style.background) } : {}),
            ...(overlay.style?.padding ? { padding: String(overlay.style.padding) } : {}),
            cursor: editable ? 'move' : (overlay.linkUrl ? 'pointer' : 'default'),
          }}
          onMouseDown={(e) => handleMouseDown(overlay.id, e)}
        >
          {/* Edit grip */}
          {editable && (
            <div className="absolute -top-5 left-0 flex items-center gap-1 bg-white dark:bg-slate-700 rounded px-1 py-0.5 shadow text-[10px] opacity-0 hover:opacity-100 transition-opacity">
              <GripHorizontal className="w-3 h-3 text-slate-400" />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(overlay.id) }}
                className="text-red-400 hover:text-red-600 font-bold"
              >×</button>
            </div>
          )}

          {overlay.overlayType === 'IMAGE' && overlay.content && (
            <OverlayImage src={overlay.content} linkUrl={overlay.linkUrl} width={overlay.width} height={overlay.height} />
          )}

          {overlay.overlayType === 'TEXT' && (
            <div
              className="w-full h-full overflow-hidden text-sm"
              dangerouslySetInnerHTML={{ __html: overlay.content || '' }}
            />
          )}

          {overlay.overlayType === 'SHAPE' && (
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: overlay.content || '' }}
            />
          )}

          {overlay.overlayType === 'DIVIDER' && (
            <div className="w-full h-full flex items-center">
              <hr className="w-full border-slate-300 dark:border-slate-600" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function OverlayImage({ src, linkUrl, width, height }: {
  src: string; linkUrl?: string | null; width: number; height: number
}) {
  const img = (
    <img
      src={src}
      alt="overlay"
      className="w-full h-full object-contain"
      style={{ width, height }}
      draggable={false}
    />
  )

  if (linkUrl) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer">
        {img}
      </a>
    )
  }
  return img
}
