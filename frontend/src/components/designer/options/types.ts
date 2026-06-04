import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import type { DesignerWidget } from '@/store/useDesignerStore'

// Context passed to every option's get/set/showIf/render. Mirrors the locals
// the old inline PropertyPanel JSX relied on (widget, chartConfig, update).
// Later phases extend this with availableCols, layers, queries, etc.
export interface OptionCtx {
  widget: DesignerWidget
  cc: Record<string, unknown>
  update: (updates: Partial<DesignerWidget>) => void
  t: TFunction
  extra?: Record<string, unknown>
}

export type OptionEditor = 'text' | 'number' | 'select' | 'checkbox' | 'color'

export interface SelectOpt {
  value: string
  nameKey: string
}

// One configurable option. Simple options declare an editor + get/set; complex
// ones (value fields, layers, thresholds...) supply a custom render(). Both
// carry category + nameKey so a single registry drives both the collapsible
// sections and the option search.
export interface OptionDef {
  id: string
  category: string
  nameKey: string
  showIf?: (ctx: OptionCtx) => boolean
  // Simple declarative editor:
  editor?: OptionEditor
  get?: (ctx: OptionCtx) => unknown
  set?: (ctx: OptionCtx, value: unknown) => void
  selectOptions?: (ctx: OptionCtx) => SelectOpt[]
  placeholderKey?: string
  hintKey?: string
  // Complex editor: arbitrary JSX (reuses the existing blocks verbatim).
  render?: (ctx: OptionCtx) => ReactNode
}

export interface OptionCategoryDef {
  id: string
  nameKey: string
}
