import api from './client'
import type { Report, RenderReportResponse, Schedule } from '@/types'

export const reportApi = {
  list: (params?: { status?: string; page?: number; size?: number }) =>
    api.get('/reports', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Report>(`/reports/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<Report>('/reports', data).then(r => r.data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<Report>(`/reports/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/reports/${id}`),

  publish: (id: number) =>
    api.post<Report>(`/reports/${id}/publish`).then(r => r.data),

  archive: (id: number) =>
    api.post<Report>(`/reports/${id}/archive`).then(r => r.data),

  duplicate: (id: number, name?: string) =>
    api.post<Report>(`/reports/${id}/duplicate`, null, { params: { name } }).then(r => r.data),

  render: (id: number, parameters?: Record<string, unknown>) =>
    api.post<RenderReportResponse>(`/reports/${id}/render`, { parameters }).then(r => r.data),

  // Widgets
  getWidgets: (reportId: number) =>
    api.get(`/reports/${reportId}/widgets`).then(r => r.data),

  addWidget: (reportId: number, data: Record<string, unknown>) =>
    api.post(`/reports/${reportId}/widgets`, data).then(r => r.data),

  setParameters: (reportId: number, params: Array<Record<string, unknown>>) =>
    api.put(`/reports/${reportId}/parameters`, params).then(r => r.data),

  deleteWidget: (widgetId: number) =>
    api.delete(`/reports/widgets/${widgetId}`),

  updateWidget: (widgetId: number, data: Record<string, unknown>) =>
    api.put(`/reports/widgets/${widgetId}`, data).then(r => r.data),

  // Parameters
  getParameters: (reportId: number) =>
    api.get(`/reports/${reportId}/parameters`).then(r => r.data),

  // Snapshots
  getSnapshots: (reportId: number) =>
    api.get(`/reports/${reportId}/snapshots`).then(r => r.data),

  createSnapshot: (reportId: number, parameters?: Record<string, unknown>) =>
    api.post(`/reports/${reportId}/snapshot`, { parameters }).then(r => r.data),
}

export const scheduleApi = {
  list: () =>
    api.get<Schedule[]>('/schedules').then(r => r.data),

  listForReport: (reportId: number) =>
    api.get<Schedule[]>(`/schedules/report/${reportId}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<Schedule>('/schedules', data).then(r => r.data),

  toggle: (id: number) =>
    api.post<Schedule>(`/schedules/${id}/toggle`).then(r => r.data),

  executeNow: (id: number) =>
    api.post(`/schedules/${id}/execute`).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/schedules/${id}`),
}
