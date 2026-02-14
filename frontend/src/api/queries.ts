import api from './client'
import type { SavedQuery, QueryResult, PageResponse } from '@/types'

export const queryApi = {
  list: (params?: { datasourceId?: number; page?: number; size?: number }) =>
    api.get<PageResponse<SavedQuery>>('/queries', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<SavedQuery>(`/queries/${id}`).then(r => r.data),

  execute: (id: number, parameters?: Record<string, unknown>) =>
    api.post<QueryResult>(`/queries/${id}/execute`, { parameters }).then(r => r.data),

  executeAdHoc: (data: { datasourceId: number; sql: string; parameters?: Record<string, unknown>; limit?: number }) =>
    api.post<QueryResult>('/query/execute', data).then(r => r.data),

  search: (term: string) =>
    api.get<SavedQuery[]>('/queries/search', { params: { term } }).then(r => r.data),
}
