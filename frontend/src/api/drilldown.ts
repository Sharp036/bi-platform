import api from './client'
import type { DrillAction, DrillActionCreateRequest, DrillActionUpdateRequest, DrillNavigateResponse } from '@/types'

export const drillApi = {
  create: (data: DrillActionCreateRequest) =>
    api.post<DrillAction>('/drill-actions', data).then(r => r.data),

  getById: (id: number) =>
    api.get<DrillAction>(`/drill-actions/${id}`).then(r => r.data),

  update: (id: number, data: DrillActionUpdateRequest) =>
    api.put<DrillAction>(`/drill-actions/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/drill-actions/${id}`),

  forWidget: (widgetId: number) =>
    api.get<DrillAction[]>(`/drill-actions/widget/${widgetId}`).then(r => r.data),

  forReport: (reportId: number) =>
    api.get<Record<number, DrillAction[]>>(`/drill-actions/report/${reportId}`).then(r => r.data),

  navigate: (data: { actionId: number; clickedData: Record<string, unknown>; currentParameters: Record<string, unknown> }) =>
    api.post<DrillNavigateResponse>('/drill-actions/navigate', data).then(r => r.data),
}
