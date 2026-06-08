import { create } from 'zustand'
import i18n from 'i18next'
import type { ChartLayerItem } from '@/types'

export interface DesignerWidget {
  id: string                // temp client ID (negative or uuid)
  serverId?: number         // server ID after save
  widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE' | 'BUTTON' | 'WEBPAGE' | 'SPACER' | 'DIVIDER'
  title: string
  // HTML body for TEXT widgets (and any future long-form widget). Lives in
  // its own backend column, not in chartConfig or title - title is the
  // display name, chartConfig is for chart-style settings.
  body: string
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

  // Chart layers (loaded on demand in designer, keyed by widget.id)
  widgetLayers: Record<string, ChartLayerItem[]>
  setWidgetLayers: (widgetId: string, layers: ChartLayerItem[]) => void
  updateWidgetLayer: (widgetId: string, layerId: number, patch: Partial<ChartLayerItem>) => void
  addWidgetLayer: (widgetId: string, layer: ChartLayerItem) => void
  removeWidgetLayer: (widgetId: string, layerId: number) => void

  // Actions
  setReportMeta: (name: string, description: string) => void
  loadReport: (data: {
    id: number; name: string; description: string; status: string
    widgets: Array<Record<string, unknown>>
    parameters: Array<Record<string, unknown>>
  }) => void

  addWidget: (type: DesignerWidget['widgetType'], containerWidgetIds?: Set<string>) => void
  updateWidget: (id: string, updates: Partial<DesignerWidget>) => void
  removeWidget: (id: string) => void
  duplicateWidget: (id: string) => void
  // Insert a widget returned by the backend duplicate endpoint (already saved,
  // with its server-side elements copied). Returns the new client id.
  addServerWidget: (w: Record<string, unknown>) => string
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
  CHART:   { position: { x: 0, y: 0, w: 6, h: 4 }, chartConfig: { type: 'bar' } },
  TABLE:   { position: { x: 0, y: 0, w: 12, h: 4 }, chartConfig: {} },
  KPI:     { position: { x: 0, y: 0, w: 3, h: 2 }, chartConfig: { format: 'number' } },
  TEXT:    { position: { x: 0, y: 0, w: 6, h: 2 }, chartConfig: {} },
  FILTER:  { position: { x: 0, y: 0, w: 3, h: 1 }, chartConfig: {} },
  IMAGE:   { position: { x: 0, y: 0, w: 4, h: 3 }, chartConfig: {} },
  BUTTON:  { position: { x: 0, y: 0, w: 2, h: 1 }, chartConfig: { buttonType: 'SHOW_HIDE', label: '', size: 'small' } },
  WEBPAGE: { position: { x: 0, y: 0, w: 12, h: 6 }, chartConfig: {} },
  SPACER:  { position: { x: 0, y: 0, w: 12, h: 1 }, chartConfig: {} },
  DIVIDER: { position: { x: 0, y: 0, w: 12, h: 1 }, chartConfig: {} },
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
  const maxHByY = new Map<number, number>()
  for (const w of widgets) {
    const existing = maxHByY.get(w.position.y) || 0
    maxHByY.set(w.position.y, Math.max(existing, w.position.h))
  }
  let maxEnd = 0
  for (const [y, h] of maxHByY) {
    maxEnd = Math.max(maxEnd, y + h)
  }
  return maxEnd
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
  widgetLayers: {},

  setWidgetLayers: (widgetId, layers) =>
    set(s => ({ widgetLayers: { ...s.widgetLayers, [widgetId]: layers } })),

  updateWidgetLayer: (widgetId, layerId, patch) =>
    set(s => ({
      widgetLayers: {
        ...s.widgetLayers,
        [widgetId]: (s.widgetLayers[widgetId] || []).map(l =>
          l.id === layerId ? { ...l, ...patch } : l
        ),
      },
    })),

  addWidgetLayer: (widgetId, layer) =>
    set(s => ({
      widgetLayers: { ...s.widgetLayers, [widgetId]: [...(s.widgetLayers[widgetId] || []), layer] },
      dirty: true,
    })),

  removeWidgetLayer: (widgetId, layerId) =>
    set(s => ({
      widgetLayers: { ...s.widgetLayers, [widgetId]: (s.widgetLayers[widgetId] || []).filter(l => l.id !== layerId) },
      dirty: true,
    })),

  setReportMeta: (name, description) =>
    set({ reportName: name, reportDescription: description, dirty: true }),

  loadReport: (data) => {
    const widgets: DesignerWidget[] = (data.widgets || []).map((w: Record<string, unknown>, i: number) => {
      const pos = typeof w.position === 'string' ? JSON.parse(w.position as string) : (w.position || {})
      const chart = typeof w.chartConfig === 'string' ? JSON.parse(w.chartConfig as string) : (w.chartConfig || {})
      const style = typeof w.style === 'string' ? JSON.parse(w.style as string) : (w.style || {})
      const pm = typeof w.paramMapping === 'string' ? JSON.parse(w.paramMapping as string) : (w.paramMapping || {})

      // Legacy chart-type aliases. The bar/area variants used to be modelled
      // as separate chart types (horizontal_bar / stacked_bar / stacked_area)
      // which made combinations impossible (no horizontal+stacked) and grew
      // combinatorially. Now they are orthogonal options on the base type.
      // Translate on load so existing widgets keep rendering; on next save
      // the report stores the new shape.
      if (chart.type === 'horizontal_bar') {
        chart.type = 'bar'
        if (chart.orientation === undefined) chart.orientation = 'horizontal'
      } else if (chart.type === 'stacked_bar') {
        chart.type = 'bar'
        if (chart.stacked === undefined) chart.stacked = true
      } else if (chart.type === 'stacked_area') {
        chart.type = 'area'
        if (chart.stacked === undefined) chart.stacked = true
      }
      // Body is the new dedicated column for TEXT widget HTML. For widgets
      // saved before V28 it might be missing on the API response, so we fall
      // back to chartConfig.content (interim location) or widget.title
      // (legacy HTML-in-title) so old widgets keep rendering during rollout.
      // Three code paths:
      //   V28+: body comes from the API column, title is the display name.
      //   Interim: body in chartConfig.content, name in chartConfig.widgetName.
      //   Legacy: HTML body in widget.title, no name (we blank title so the
      //   canvas header does not duplicate the body preview).
      const titleFromApi = (w.title as string) || ''
      const bodyFromApi = typeof w.body === 'string' ? (w.body as string) : ''
      const ccBag = chart as Record<string, unknown>
      const bodyFromConfig = typeof ccBag.content === 'string' ? (ccBag.content as string) : ''
      const widgetNameInterim = typeof ccBag.widgetName === 'string' ? (ccBag.widgetName as string) : ''
      const legacyTitleAsBody = w.widgetType === 'TEXT' && /<[^>]+>/.test(titleFromApi)
        ? titleFromApi
        : ''

      let resolvedBody = ''
      let resolvedTitle = titleFromApi
      if (bodyFromApi) {
        resolvedBody = bodyFromApi
      } else if (bodyFromConfig) {
        resolvedBody = bodyFromConfig
        resolvedTitle = widgetNameInterim || titleFromApi
      } else if (legacyTitleAsBody) {
        resolvedBody = legacyTitleAsBody
        resolvedTitle = ''
      }

      return {
        id: genId(),
        serverId: (w.widgetId as number | undefined) ?? (w.id as number | undefined),
        widgetType: w.widgetType as DesignerWidget['widgetType'],
        title: resolvedTitle,
        body: resolvedBody || '',
        queryId: (w.queryId as number | undefined) ?? null,
        datasourceId: (w.datasourceId as number | undefined) ?? null,
        rawSql: (w.rawSql as string) || '',
        chartConfig: chart,
        position: {
          x: Number(pos.x ?? 0),
          y: Number(pos.y ?? (i * 4)),
          w: Number(pos.w ?? 12),
          h: Number(pos.h ?? 4),
        },
        style,
        paramMapping: pm,
        isVisible: w.isVisible !== false,
        sortOrder: (w.sortOrder as number | undefined) ?? i,
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

  addWidget: (type, containerWidgetIds) => set(state => {
    const defaults = WIDGET_DEFAULTS[type] || {}
    const widget: DesignerWidget = {
      id: genId(),
      widgetType: type,
      title: i18n.t(`widgets.type.${type.toLowerCase()}`),
      body: '',
      queryId: null,
      datasourceId: null,
      rawSql: '',
      chartConfig: (defaults.chartConfig as Record<string, unknown>) || {},
      position: {
        x: defaults.position?.x || 0,
        y: findNextY(containerWidgetIds ? state.widgets.filter(w => !containerWidgetIds.has(w.id)) : state.widgets),
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
    // Carry the source chart's layers to the copy so combined/mixed charts keep
    // their per-series config. Layers are stored separately, keyed by widget id;
    // they get fresh server rows on save (their stale ids/widgetId are ignored).
    // Copy layers 1:1 (including their categoryField/valueField); the user
    // repoints them afterwards via the per-layer category/value editors.
    const srcLayers = state.widgetLayers[source.id]
    const widgetLayers = srcLayers && srcLayers.length
      ? { ...state.widgetLayers, [dup.id]: srcLayers.map(l => ({ ...l })) }
      : state.widgetLayers
    return {
      widgets: newWidgets,
      widgetLayers,
      selectedWidgetId: dup.id,
      ...pushHistory({ ...state, widgets: newWidgets }),
    }
  }),

  addServerWidget: (w) => {
    const parse = (v: unknown, d: unknown) => {
      if (typeof v !== 'string') return v ?? d
      try { return JSON.parse(v) } catch { return d }
    }
    const pos = parse(w.position, {}) as Record<string, unknown>
    // A backend duplicate is always in modern shape (no legacy chart-type
    // aliases / TEXT-in-title), so a thin mapping is enough here.
    const dup: DesignerWidget = {
      id: genId(),
      serverId: (w.widgetId as number | undefined) ?? (w.id as number | undefined),
      widgetType: w.widgetType as DesignerWidget['widgetType'],
      title: (w.title as string) || '',
      body: (w.body as string) || '',
      queryId: (w.queryId as number | undefined) ?? null,
      datasourceId: (w.datasourceId as number | undefined) ?? null,
      rawSql: (w.rawSql as string) || '',
      chartConfig: parse(w.chartConfig, {}) as Record<string, unknown>,
      position: {
        x: Number(pos.x ?? 0), y: Number(pos.y ?? 0),
        w: Number(pos.w ?? 12), h: Number(pos.h ?? 4),
      },
      style: parse(w.style, {}) as Record<string, unknown>,
      paramMapping: parse(w.paramMapping, {}) as Record<string, string>,
      isVisible: w.isVisible !== false,
      sortOrder: (w.sortOrder as number | undefined) ?? 0,
    }
    set(state => {
      const newWidgets = [...state.widgets, dup]
      return {
        widgets: newWidgets,
        selectedWidgetId: dup.id,
        ...pushHistory({ ...state, widgets: newWidgets }),
      }
    })
    return dup.id
  },

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
