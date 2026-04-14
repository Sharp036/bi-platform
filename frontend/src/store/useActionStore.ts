import { create } from 'zustand'
import type { DashboardActionItem } from '@/types'
import { log } from '@/utils/logger'

/**
 * Active filters applied by cross-filter actions.
 * key = targetWidgetId, value = map of field→value filters
 */
export interface ActionFilter {
  sourceWidgetId: number
  field: string
  value: unknown
}

export interface DrillReplaceEntry {
  sourceWidgetId: number
  targetWidgetIds: number[]
  filters: ActionFilter[]
  label: string
  seriesName?: string
  paramName?: string
  paramValue?: string
  prevParamValue?: string
}

interface ActionState {
  actions: DashboardActionItem[]
  activeFilters: Record<number, ActionFilter[]>  // targetWidgetId → filters
  highlightedValues: Record<number, { field: string; value: unknown }>  // widgetId → highlight
  drillReplaceStack: DrillReplaceEntry[]

  setActions: (actions: DashboardActionItem[]) => void

  // Called when user clicks/hovers on a chart element
  triggerAction: (sourceWidgetId: number, triggerType: string, data: Record<string, unknown>) => void

  // Called when user clears selection
  clearFiltersFromSource: (sourceWidgetId: number) => void

  // Get active filters for a specific widget
  getFiltersForWidget: (widgetId: number) => ActionFilter[]

  // Undo a drill replace (back button)
  undoDrillReplace: (sourceWidgetId: number) => void

  // Reset all
  reset: () => void
}

export const useActionStore = create<ActionState>((set, get) => ({
  actions: [],
  activeFilters: {},
  highlightedValues: {},
  drillReplaceStack: [],

  setActions: (actions) => set({ actions }),

  triggerAction: (sourceWidgetId, triggerType, data) => {
    log.action('triggerAction', { sourceWidgetId, triggerType, dataKeys: Object.keys(data), name: data.name, seriesName: data.seriesName })
    const { actions, activeFilters, highlightedValues } = get()

    // Find matching actions
    const matching = actions.filter(a =>
      a.isActive &&
      a.sourceWidgetId === sourceWidgetId &&
      a.triggerType === triggerType
    )

    if (matching.length === 0) return

    const newFilters = { ...activeFilters }
    const newHighlights = { ...highlightedValues }
    let newDrillStack: DrillReplaceEntry[] | null = null

    for (const action of matching) {
      const targetIds = resolveTargetWidgets(action)
      const sourceValue = data[action.sourceField || '']

      switch (action.actionType) {
        case 'FILTER': {
          for (const targetId of targetIds) {
            const existing = newFilters[targetId] || []
            // Remove old filter from same source+field, add new
            const filtered = existing.filter(f =>
              !(f.sourceWidgetId === sourceWidgetId && f.field === (action.targetField || action.sourceField || ''))
            )
            if (sourceValue !== undefined && sourceValue !== null) {
              filtered.push({
                sourceWidgetId,
                field: action.targetField || action.sourceField || '',
                value: sourceValue,
              })
            }
            newFilters[targetId] = filtered
          }
          break
        }

        case 'HIGHLIGHT': {
          for (const targetId of targetIds) {
            if (sourceValue !== undefined) {
              newHighlights[targetId] = {
                field: action.targetField || action.sourceField || '',
                value: sourceValue,
              }
            }
          }
          break
        }

        case 'NAVIGATE': {
          if (action.targetReportId) {
            window.location.href = `/reports/${action.targetReportId}/view`
          }
          break
        }

        case 'URL': {
          if (action.urlTemplate) {
            let url = action.urlTemplate
            for (const [key, val] of Object.entries(data)) {
              url = url.replace(`{${key}}`, encodeURIComponent(String(val)))
            }
            window.open(url, '_blank')
          }
          break
        }

        case 'DRILL_REPLACE': {
          const drillFilters: ActionFilter[] = []
          const clickedSeries = data.seriesName != null ? String(data.seriesName) : undefined
          if (sourceValue !== undefined && sourceValue !== null) {
            for (const targetId of targetIds) {
              const filterField = action.targetField || action.sourceField || ''
              const filter: ActionFilter = { sourceWidgetId, field: filterField, value: sourceValue }
              drillFilters.push(filter)
              const existing = newFilters[targetId] || []
              const filtered = existing.filter(f =>
                !(f.sourceWidgetId === sourceWidgetId && f.field === filterField)
              )
              filtered.push(filter)
              newFilters[targetId] = filtered
            }
          }
          const entry: DrillReplaceEntry = {
            sourceWidgetId,
            targetWidgetIds: targetIds,
            filters: drillFilters,
            label: sourceValue != null ? String(sourceValue) : '',
            seriesName: clickedSeries,
          }
          newDrillStack = [...get().drillReplaceStack, entry]
          break
        }
      }
    }

    set({
      activeFilters: newFilters,
      highlightedValues: newHighlights,
      ...(newDrillStack ? { drillReplaceStack: newDrillStack } : {}),
    })
  },

  clearFiltersFromSource: (sourceWidgetId) => {
    const { activeFilters, highlightedValues } = get()
    const newFilters: Record<number, ActionFilter[]> = {}

    for (const [widgetId, filters] of Object.entries(activeFilters)) {
      const remaining = filters.filter(f => f.sourceWidgetId !== sourceWidgetId)
      if (remaining.length > 0) {
        newFilters[Number(widgetId)] = remaining
      }
    }

    const newHighlights = { ...highlightedValues }
    // Remove highlights that came from this source (simplified)
    for (const key of Object.keys(newHighlights)) {
      delete newHighlights[Number(key)]
    }

    set({ activeFilters: newFilters, highlightedValues: newHighlights })
  },

  getFiltersForWidget: (widgetId) => {
    return get().activeFilters[widgetId] || []
  },

  undoDrillReplace: (sourceWidgetId: number) => {
    log.action('undoDrillReplace', { sourceWidgetId })
    const { drillReplaceStack, activeFilters } = get()
    const idx = drillReplaceStack.findIndex(e => e.sourceWidgetId === sourceWidgetId)
    if (idx === -1) return
    const entry = drillReplaceStack[idx]
    // Remove filters that were applied by this drill
    const newFilters = { ...activeFilters }
    for (const targetId of entry.targetWidgetIds) {
      const existing = newFilters[targetId] || []
      newFilters[targetId] = existing.filter(f => f.sourceWidgetId !== sourceWidgetId)
      if (newFilters[targetId].length === 0) delete newFilters[targetId]
    }
    const newStack = drillReplaceStack.filter((_, i) => i !== idx)
    set({ drillReplaceStack: newStack, activeFilters: newFilters })
  },

  reset: () => set({ activeFilters: {}, highlightedValues: {}, drillReplaceStack: [], actions: [] }),
}))

function resolveTargetWidgets(action: DashboardActionItem): number[] {
  const raw = action.targetWidgetIds
  if (!raw || raw === '*') return [] // '*' handled at render level
  return raw.split(',').map(s => s.trim()).filter(s => !s.startsWith('-')).map(Number).filter(n => !isNaN(n))
}

/**
 * Build WHERE-clause additions from active cross-filters.
 */
export function buildFilterSql(filters: ActionFilter[]): string {
  if (filters.length === 0) return ''
  return filters.map(f => {
    const val = f.value
    if (typeof val === 'string') return `"${f.field}" = '${val.replace(/'/g, "''")}'`
    if (typeof val === 'number') return `"${f.field}" = ${val}`
    return ''
  }).filter(Boolean).join(' AND ')
}
