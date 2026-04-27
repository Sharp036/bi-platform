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
  filters: ActionFilter[]               // legacy client-side filters (no paramName configured)
  paramOverrides: Record<string, unknown> // param-based drill (action.config.paramName set)
  label: string
  seriesName?: string
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

    // Batch DRILL_REPLACE actions from the same trigger into ONE stack entry.
    // Each action may contribute either a parameter override (preferred) or a
    // client-side field filter (legacy, for actions without config.paramName).
    const drillParamOverrides: Record<string, unknown> = {}
    const drillFilters: ActionFilter[] = []
    const drillTargets = new Set<number>()
    const drillLabels: string[] = []
    let drillSeries: string | undefined
    let hasDrillAction = false

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
          hasDrillAction = true
          targetIds.forEach(t => drillTargets.add(t))
          if (data.seriesName != null) drillSeries = String(data.seriesName)
          if (sourceValue === undefined || sourceValue === null) break

          const cfg = (action.config as Record<string, unknown> | undefined) ?? {}
          const paramName = cfg.paramName as string | undefined
          const split = cfg.split as { separator?: string; index?: number } | undefined
          const paramMappings = cfg.paramMappings as Array<{
            paramName: string
            sourceField?: string
            split?: { separator?: string; index?: number }
          }> | undefined

          const applyValue = (raw: unknown, splitCfg?: { separator?: string; index?: number }): unknown => {
            if (!splitCfg || !splitCfg.separator || typeof raw !== 'string') return raw
            const parts = raw.split(splitCfg.separator)
            const idx = typeof splitCfg.index === 'number' ? splitCfg.index : 0
            return parts[idx] ?? raw
          }

          if (Array.isArray(paramMappings) && paramMappings.length > 0) {
            // Multi-param drill: one click sets several report parameters,
            // each with its own source column and optional split.
            for (const mapping of paramMappings) {
              if (!mapping.paramName) continue
              const srcField = mapping.sourceField || action.sourceField || ''
              const raw = srcField ? data[srcField] : sourceValue
              if (raw == null) continue
              drillParamOverrides[mapping.paramName] = applyValue(raw, mapping.split)
            }
          } else if (typeof paramName === 'string' && paramName) {
            // Single-param drill (optionally with split). Widget SQL re-runs with
            // the new parameter in WHERE, so ClickHouse returns only matching rows.
            drillParamOverrides[paramName] = applyValue(sourceValue, split)
          } else {
            // Legacy field-based drill: client-side filter on widget data.
            const filterField = action.targetField || action.sourceField || ''
            const filter: ActionFilter = { sourceWidgetId, field: filterField, value: sourceValue }
            drillFilters.push(filter)
            for (const targetId of targetIds) {
              const existing = newFilters[targetId] || []
              const filtered = existing.filter(f =>
                !(f.sourceWidgetId === sourceWidgetId && f.field === filterField)
              )
              filtered.push(filter)
              newFilters[targetId] = filtered
            }
          }
          drillLabels.push(String(sourceValue))
          break
        }
      }
    }

    // Combine all DRILL_REPLACE actions from this trigger into one stack entry
    if (hasDrillAction && drillTargets.size > 0) {
      const entry: DrillReplaceEntry = {
        sourceWidgetId,
        targetWidgetIds: [...drillTargets],
        filters: drillFilters,
        paramOverrides: drillParamOverrides,
        label: drillLabels.join(' / '),
        seriesName: drillSeries,
      }
      newDrillStack = [...get().drillReplaceStack, entry]
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

// Expose store on window for diagnostic console access:
//   __actionStore.getState().activeFilters
//   __actionStore.getState().drillReplaceStack
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__actionStore = useActionStore
}

function resolveTargetWidgets(action: DashboardActionItem): number[] {
  const raw = action.targetWidgetIds
  if (!raw || raw === '*') return [] // '*' handled at render level
  return raw.split(',').map(s => s.trim()).filter(s => !s.startsWith('-')).map(Number).filter(n => !isNaN(n))
}

/**
 * Compute effective report parameters by applying drill-replace overrides
 * on top of the user's filter-panel values. Later entries override earlier.
 */
export function mergeDrillParams(
  basePrams: Record<string, unknown>,
  drillStack: DrillReplaceEntry[],
): Record<string, unknown> {
  let result = { ...basePrams }
  for (const entry of drillStack) {
    if (entry.paramOverrides) {
      result = { ...result, ...entry.paramOverrides }
    }
  }
  return result
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
