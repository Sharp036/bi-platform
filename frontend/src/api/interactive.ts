import api from './client'
import type {
  ChartLayerItem, ChartLayerRequest, DashboardActionItem, DashboardActionRequest,
  VisibilityRuleItem, VisibilityRuleRequest, OverlayItem, OverlayRequest,
  InteractiveMeta,
} from '@/types'

export const interactiveApi = {
  // Chart Layers
  createLayer: (data: ChartLayerRequest) =>
    api.post<ChartLayerItem>('/interactive/layers', data).then(r => r.data),
  updateLayer: (id: number, data: ChartLayerRequest) =>
    api.put<ChartLayerItem>(`/interactive/layers/${id}`, data).then(r => r.data),
  getLayersForWidget: (widgetId: number) =>
    api.get<ChartLayerItem[]>(`/interactive/layers/widget/${widgetId}`).then(r => r.data),
  deleteLayer: (id: number) =>
    api.delete(`/interactive/layers/${id}`),

  // Dashboard Actions
  createAction: (data: DashboardActionRequest) =>
    api.post<DashboardActionItem>('/interactive/actions', data).then(r => r.data),
  updateAction: (id: number, data: DashboardActionRequest) =>
    api.put<DashboardActionItem>(`/interactive/actions/${id}`, data).then(r => r.data),
  getActionsForReport: (reportId: number) =>
    api.get<DashboardActionItem[]>(`/interactive/actions/report/${reportId}`).then(r => r.data),
  deleteAction: (id: number) =>
    api.delete(`/interactive/actions/${id}`),

  // Visibility Rules
  createRule: (data: VisibilityRuleRequest) =>
    api.post<VisibilityRuleItem>('/interactive/visibility', data).then(r => r.data),
  updateRule: (id: number, data: VisibilityRuleRequest) =>
    api.put<VisibilityRuleItem>(`/interactive/visibility/${id}`, data).then(r => r.data),
  getRulesForWidget: (widgetId: number) =>
    api.get<VisibilityRuleItem[]>(`/interactive/visibility/widget/${widgetId}`).then(r => r.data),
  deleteRule: (id: number) =>
    api.delete(`/interactive/visibility/${id}`),

  // Overlays
  createOverlay: (data: OverlayRequest) =>
    api.post<OverlayItem>('/interactive/overlays', data).then(r => r.data),
  updateOverlay: (id: number, data: OverlayRequest) =>
    api.put<OverlayItem>(`/interactive/overlays/${id}`, data).then(r => r.data),
  getOverlaysForReport: (reportId: number) =>
    api.get<OverlayItem[]>(`/interactive/overlays/report/${reportId}`).then(r => r.data),
  deleteOverlay: (id: number) =>
    api.delete(`/interactive/overlays/${id}`),

  // Full meta
  getMeta: (reportId: number, widgetIds: number[]) =>
    api.get<InteractiveMeta>(`/interactive/meta/report/${reportId}`, {
      params: { widgetIds: widgetIds.join(',') }
    }).then(r => r.data),
}
