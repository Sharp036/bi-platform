import api from './client'
import type {
  CalcField, CalcFieldCreateRequest, CalcFieldUpdateRequest,
  DataAlert, AlertCreateRequest, AlertUpdateRequest, AlertCheckResult, AlertEvent,
  BookmarkItem, BookmarkCreateRequest, BookmarkUpdateRequest,
} from '@/types'

export const calcFieldApi = {
  create: (data: CalcFieldCreateRequest) =>
    api.post<CalcField>('/calculated-fields', data).then(r => r.data),

  getById: (id: number) =>
    api.get<CalcField>(`/calculated-fields/${id}`).then(r => r.data),

  listForReport: (reportId: number) =>
    api.get<CalcField[]>(`/calculated-fields/report/${reportId}`).then(r => r.data),

  update: (id: number, data: CalcFieldUpdateRequest) =>
    api.put<CalcField>(`/calculated-fields/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/calculated-fields/${id}`),
}

export const alertApi = {
  create: (data: AlertCreateRequest) =>
    api.post<DataAlert>('/alerts', data).then(r => r.data),

  getById: (id: number) =>
    api.get<DataAlert>(`/alerts/${id}`).then(r => r.data),

  listForReport: (reportId: number) =>
    api.get<DataAlert[]>(`/alerts/report/${reportId}`).then(r => r.data),

  listActive: () =>
    api.get<DataAlert[]>('/alerts/active').then(r => r.data),

  update: (id: number, data: AlertUpdateRequest) =>
    api.put<DataAlert>(`/alerts/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/alerts/${id}`),

  check: (id: number) =>
    api.post<AlertCheckResult>(`/alerts/${id}/check`).then(r => r.data),

  checkAll: () =>
    api.post<AlertCheckResult[]>('/alerts/check-all').then(r => r.data),

  getEvents: (id: number, page?: number) =>
    api.get<AlertEvent[]>(`/alerts/${id}/events`, { params: { page } }).then(r => r.data),
}

export const bookmarkApi = {
  create: (data: BookmarkCreateRequest) =>
    api.post<BookmarkItem>('/bookmarks', data).then(r => r.data),

  getById: (id: number) =>
    api.get<BookmarkItem>(`/bookmarks/${id}`).then(r => r.data),

  listForReport: (reportId: number) =>
    api.get<BookmarkItem[]>(`/bookmarks/report/${reportId}`).then(r => r.data),

  getDefault: (reportId: number) =>
    api.get<BookmarkItem>(`/bookmarks/report/${reportId}/default`).then(r => r.data).catch(() => null),

  update: (id: number, data: BookmarkUpdateRequest) =>
    api.put<BookmarkItem>(`/bookmarks/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/bookmarks/${id}`),
}
