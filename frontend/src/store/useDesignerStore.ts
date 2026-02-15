import { create } from 'zustand'
import i18n from 'i18next'

export interface DesignerWidget {
  id: string                // temp client ID (negative or uuid)
  serverId?: number         // server ID after save
  widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE'
  title: string
  queryId: number | null
  datasourceId: number | null
  rawSql: string
  chartConfig: Record<string, unknown>
  position: { x: number; y: number; w: number; h: number }
  style: Record<string, unknown>
  paramMapping: Record<string, string>
  isVisible: boolean
  sortOrder: number
}

interface DesignerState {
  // Report metadata
  reportId: number | null
  reportName: string
  reportDescription: string
  reportStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

  // Widgets
  widgets: DesignerWidget[]
  selectedWidgetId: string | null

  // Parameters
  parameters: Array<{
    id?: number; name: string; label: string
    paramType: string; defaultValue: string
    isRequired: boolean; sortOrder: number
  }>

  // Undo/redo
  history: DesignerWidget[][]
  historyIndex: number

  // Mode
  previewMode: boolean
  dirty: boolean

  // Actions
  setReportMeta: (name: string, description: string) => void
  loadReport: (data: {
    id: number; name: string; description: string; status: string
    widgets: Array<Record<string, unknown>>
    parameters: Array<Record<string, unknown>>
  }) => void

  addWidget: (type: DesignerWidget['widgetType']) => void
  updateWidget: (id: string, updates: Partial<DesignerWidget>) => void
  removeWidget: (id: string) => void
  duplicateWidget: (id: string) => void
  selectWidget: (id: string | null) => void
  reorderWidget: (id: string, newOrder: number) => void
  moveWidget: (id: string, position: { x: number; y: number; w: number; h: number }) => void

  setParameters: (params: DesignerState['parameters']) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  togglePreview: () => void
  setDirty: (dirty: boolean) => void
  reset: () => void
}

let nextId = 1
const genId = () => `w_${nextId++}`

const WIDGET_DEFAULTS: Record<string, Partial<DesignerWidget>> = {
  CHART: { position: { x: 0, y: 0, w: 6, h: 4 }, chartConfig: { type: 'bar' } },
  TABLE: { position: { x: 0, y: 0, w: 12, h: 4 }, chartConfig: {} },
  KPI:   { position: { x: 0, y: 0, w: 3, h: 2 }, chartConfig: { format: 'number' } },
  TEXT:  { position: { x: 0, y: 0, w: 6, h: 2 }, chartConfig: {} },
  FILTER: { position: { x: 0, y: 0, w: 3, h: 1 }, chartConfig: {} },
  IMAGE: { position: { x: 0, y: 0, w: 4, h: 3 }, chartConfig: {} },
}

const pushHistory = (state: DesignerState): Partial<DesignerState> => {
  const newHistory = state.history.slice(0, state.historyIndex + 1)
  newHistory.push(JSON.parse(JSON.stringify(state.widgets)))
  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
    dirty: true,
  }
}

const findNextY = (widgets: DesignerWidget[]): number => {
  if (widgets.length === 0) return 0
  return Math.max(...widgets.map(w => w.position.y + w.position.h))
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  reportId: null,
  reportName: '',
  reportDescription: '',
  reportStatus: 'DRAFT',
  widgets: [],
  selectedWidgetId: null,
  parameters: [],
  history: [[]],
  historyIndex: 0,
  previewMode: false,
  dirty: false,

  setReportMeta: (name, description) =>
    set({ reportName: name, reportDescription: description, dirty: true }),

  loadReport: (data) => {
    const widgets: DesignerWidget[] = (data.widgets || []).map((w: Record<string, unknown>, i: number) => {
      const pos = typeof w.position === 'string' ? JSON.parse(w.position as string) : (w.position || {})
      const chart = typeof w.chartConfig === 'string' ? JSON.parse(w.chartConfig as string) : (w.chartConfig || {})
      const style = typeof w.style === 'string' ? JSON.parse(w.style as string) : (w.style || {})
      const pm = typeof w.paramMapping === 'string' ? JSON.parse(w.paramMapping as string) : (w.paramMapping || {})
      return {
        id: genId(),
        serverId: w.widgetId as number || w.id as number,
        widgetType: w.widgetType as DesignerWidget['widgetType'],
        title: (w.title as string) || '',
        queryId: (w.queryId as number) || null,
        datasourceId: (w.datasourceId as number) || null,
        rawSql: (w.rawSql as string) || '',
        chartConfig: chart,
        position: { x: pos.x || 0, y: pos.y || i * 4, w: pos.w || 12, h: pos.h || 4 },
        style,
        paramMapping: pm,
        isVisible: w.isVisible !== false,
        sortOrder: (w.sortOrder as number) || i,
      }
    })

    const parameters = (data.parameters || []).map((p: Record<string, unknown>) => ({
      id: p.id as number | undefined,
      name: (p.name as string) || '',
      label: (p.label as string) || '',
      paramType: (p.paramType as string) || 'STRING',
      defaultValue: (p.defaultValue as string) || '',
      isRequired: p.isRequired !== false,
      sortOrder: (p.sortOrder as number) || 0,
    }))

    set({
      reportId: data.id,
      reportName: data.name,
      reportDescription: data.description || '',
      reportStatus: data.status as DesignerState['reportStatus'],
      widgets,
      parameters,
      selectedWidgetId: null,
      history: [JSON.parse(JSON.stringify(widgets))],
      historyIndex: 0,
      previewMode: false,
      dirty: false,
    })
  },

  addWidget: (type) => set(state => {
    const defaults = WIDGET_DEFAULTS[type] || {}
    const widget: DesignerWidget = {
      id: genId(),
      widgetType: type,
      title: i18n.t(`widgets.type.${type.toLowerCase()}`),
      queryId: null,
      datasourceId: null,
      rawSql: '',
      chartConfig: (defaults.chartConfig as Record<string, unknown>) || {},
      position: {
        x: defaults.position?.x || 0,
        y: findNextY(state.widgets),
        w: defaults.position?.w || 6,
        h: defaults.position?.h || 4,
      },
      style: {},
      paramMapping: {},
      isVisible: true,
      sortOrder: state.widgets.length,
    }
    const newWidgets = [...state.widgets, widget]
    return {
      widgets: newWidgets,
      selectedWidgetId: widget.id,
      ...pushHistory({ ...state, widgets: newWidgets }),
    }
  }),

  updateWidget: (id, updates) => set(state => {
    const newWidgets = state.widgets.map(w =>
      w.id === id ? { ...w, ...updates } : w
    )
    return {
      widgets: newWidgets,
      ...pushHistory({ ...state, widgets: newWidgets }),
    }
  }),

  removeWidget: (id) => set(state => {
    const newWidgets = state.widgets.filter(w => w.id !== id)
    return {
      widgets: newWidgets,
      selectedWidgetId: state.selectedWidgetId === id ? null : state.selectedWidgetId,
      ...pushHistory({ ...state, widgets: newWidgets }),
    }
  }),

  duplicateWidget: (id) => set(state => {
    const source = state.widgets.find(w => w.id === id)
    if (!source) return {}
    const dup: DesignerWidget = {
      ...JSON.parse(JSON.stringify(source)),
      id: genId(),
      serverId: undefined,
      title: source.title + ' (copy)',
      position: { ...source.position, y: source.position.y + source.position.h },
      sortOrder: state.widgets.length,
    }
    const newWidgets = [...state.widgets, dup]
    return {
      widgets: newWidgets,
      selectedWidgetId: dup.id,
      ...pushHistory({ ...state, widgets: newWidgets }),
    }
  }),

  selectWidget: (id) => set({ selectedWidgetId: id }),

  reorderWidget: (id, newOrder) => set(state => {
    const newWidgets = state.widgets.map(w =>
      w.id === id ? { ...w, sortOrder: newOrder } : w
    ).sort((a, b) => a.sortOrder - b.sortOrder)
    return { widgets: newWidgets, dirty: true }
  }),

  moveWidget: (id, position) => set(state => {
    const newWidgets = state.widgets.map(w =>
      w.id === id ? { ...w, position } : w
    )
    return {
      widgets: newWidgets,
      ...pushHistory({ ...state, widgets: newWidgets }),
    }
  }),

  setParameters: (params) => set({ parameters: params, dirty: true }),

  undo: () => set(state => {
    if (state.historyIndex <= 0) return {}
    const newIndex = state.historyIndex - 1
    return {
      widgets: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
      selectedWidgetId: null,
      dirty: true,
    }
  }),

  redo: () => set(state => {
    if (state.historyIndex >= state.history.length - 1) return {}
    const newIndex = state.historyIndex + 1
    return {
      widgets: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
      selectedWidgetId: null,
      dirty: true,
    }
  }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  togglePreview: () => set(state => ({ previewMode: !state.previewMode, selectedWidgetId: null })),
  setDirty: (dirty) => set({ dirty }),
  reset: () => set({
    reportId: null, reportName: '', reportDescription: '', reportStatus: 'DRAFT',
    widgets: [], selectedWidgetId: null, parameters: [],
    history: [[]], historyIndex: 0, previewMode: false, dirty: false,
  }),
}))
