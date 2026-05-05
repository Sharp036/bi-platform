import { Info } from 'lucide-react'
import Tooltip from './Tooltip'
import MarkdownLite from './MarkdownLite'

interface Props {
  description: string | undefined
  className?: string
}

/**
 * Small (i) icon next to a widget title. Shows the description as a markdown
 * tooltip on hover. Renders nothing if description is empty/undefined - so
 * callers can pass it unconditionally without an outer guard.
 */
export default function InfoTooltip({ description, className }: Props) {
  if (!description || !description.trim()) return null
  return (
    <Tooltip content={<MarkdownLite text={description} />}>
      <Info
        className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-help ${className || ''}`}
        aria-label="Description"
      />
    </Tooltip>
  )
}
