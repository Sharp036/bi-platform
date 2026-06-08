import { interactiveApi } from '@/api/interactive'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { ChartLayerItem } from '@/types'

// Default series colors for newly added layers (cycled by index).
const LAYER_PALETTE = ['#7c3aed', '#84cc16', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1']
export const layerColor = (i: number) => LAYER_PALETTE[i % LAYER_PALETTE.length]

// Temp ids for layers on a not-yet-saved widget. Negative so they never collide
// with real server ids and are never sent to update/delete endpoints; the save
// flow creates the real rows (see ReportDesignerPage).
let tempLayerId = -1

export interface NewLayerInput {
  name: string
  valueField: string
  categoryField?: string
  chartType?: string
  axis?: string
  color?: string
  sortOrder?: number
  seriesConfig?: Record<string, unknown>
}

// Create a layer for a widget. Saved widget -> created on the server (real id);
// unsaved widget -> stored with a temp id and created on save.
export async function createLayerFor(widget: DesignerWidget, input: NewLayerInput): Promise<ChartLayerItem> {
  const base = {
    name: input.name,
    label: input.name,
    chartType: input.chartType ?? 'bar',
    axis: input.axis ?? 'left',
    color: input.color,
    opacity: 1,
    isVisible: true,
    sortOrder: input.sortOrder ?? 0,
    seriesConfig: input.seriesConfig ?? {},
    categoryField: input.categoryField,
    valueField: input.valueField,
  }
  if (widget.serverId) {
    return interactiveApi.createLayer({ widgetId: widget.serverId, ...base })
  }
  return { id: tempLayerId--, widgetId: 0, createdAt: '', ...base }
}

// Delete a layer. Hits the server only for a real (server) layer of a saved widget.
export async function deleteLayerFor(widget: DesignerWidget, layer: ChartLayerItem): Promise<void> {
  if (widget.serverId && layer.id > 0) {
    try { await interactiveApi.deleteLayer(layer.id) } catch { /* silent */ }
  }
}

// Build a combined chart's layers from its value fields: the first field becomes
// a left-axis bar, the rest become right-axis lines - the usual combo default.
// Layers carry no categoryField, so they inherit the chart-level category.
export async function initLayersFromFields(
  widget: DesignerWidget,
  valueFields: string[],
): Promise<ChartLayerItem[]> {
  const out: ChartLayerItem[] = []
  for (let i = 0; i < valueFields.length; i++) {
    out.push(await createLayerFor(widget, {
      name: valueFields[i],
      valueField: valueFields[i],
      chartType: i === 0 ? 'bar' : 'line',
      axis: i === 0 ? 'left' : 'right',
      color: layerColor(i),
      sortOrder: i,
    }))
  }
  return out
}
