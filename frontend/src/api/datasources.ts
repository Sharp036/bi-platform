import api from './client'
import type { DataSource, DataSourceForm } from '@/types'

export interface TableInfo {
  name: string
  type: string
  columns: Array<{ name: string; type: string; nullable: boolean }>
}

export const datasourceApi = {
  list: () =>
    api.get<DataSource[]>('/datasources').then(r => r.data),

  get: (id: number) =>
    api.get<DataSource>(`/datasources/${id}`).then(r => r.data),

  create: (data: DataSourceForm) =>
    api.post<DataSource>('/datasources', data).then(r => r.data),

  update: (id: number, data: Partial<DataSourceForm>) =>
    api.put<DataSource>(`/datasources/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/datasources/${id}`),

  test: (id: number) =>
    api.post<{ success: boolean; message: string }>(`/datasources/${id}/test`).then(r => r.data),

  schema: (id: number) =>
    api.get<TableInfo[]>(`/datasources/${id}/schema`).then(r => r.data),
}
