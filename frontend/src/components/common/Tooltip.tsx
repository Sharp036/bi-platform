import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  children: ReactNode
  content: ReactNode
  className?: string
}

/**
 * Hover tooltip rendered into a portal so it can escape parent overflow:hidden
 * containers (widget cards). 100ms close delay on leave so the cursor can
 * travel from the trigger to the tooltip without flicker - lets users click
 * markdown links inside the tooltip body.
 */
export default function Tooltip({ children, content, className }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<number | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: rect.left + rect.width / 2,
    })
  }, [open])

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
  }, [])

  const enter = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }

  const leave = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 100)
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={enter}
        onMouseLeave={leave}
        className="inline-flex items-center"
      >
        {children}
      </span>
      {open && createPortal(
        <div
          onMouseEnter={enter}
          onMouseLeave={leave}
          className={`fixed z-[100] bg-slate-800 dark:bg-slate-900 text-slate-100 text-xs rounded-md shadow-lg p-2.5 max-w-xs space-y-1.5 ${className || ''}`}
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  )
}
