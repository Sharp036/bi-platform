import api from './client'
import type {
  Script, ScriptSummary, ScriptCreateRequest, ScriptUpdateRequest,
  ScriptExecuteRequest, ScriptExecuteResponse, ScriptExecution, PageResponse
} from '@/types'

export const scriptApi = {
  list: (params?: { search?: string; type?: string; page?: number; size?: number }) =>
    api.get<PageResponse<ScriptSummary>>('/scripts', { params }).then(r => r.data),

  libraries: () =>
    api.get<ScriptSummary[]>('/scripts/libraries').then(r => r.data),

  getById: (id: number) =>
    api.get<Script>(`/scripts/${id}`).then(r => r.data),

  create: (data: ScriptCreateRequest) =>
    api.post<Script>('/scripts', data).then(r => r.data),

  update: (id: number, data: ScriptUpdateRequest) =>
    api.put<Script>(`/scripts/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/scripts/${id}`),

  execute: (data: ScriptExecuteRequest) =>
    api.post<ScriptExecuteResponse>('/scripts/execute', data).then(r => r.data),

  executeById: (id: number, data?: ScriptExecuteRequest) =>
    api.post<ScriptExecuteResponse>(`/scripts/${id}/execute`, data || {}).then(r => r.data),

  executions: (id: number, page = 0) =>
    api.get<ScriptExecution[]>(`/scripts/${id}/executions`, { params: { page } }).then(r => r.data),

  recentExecutions: (page = 0) =>
    api.get<ScriptExecution[]>('/scripts/executions/recent', { params: { page } }).then(r => r.data),
}
