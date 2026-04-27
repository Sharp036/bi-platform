import api from './client'

export interface ImportSource {
  id: number; name: string; description?: string
  datasourceId: number; datasourceName: string
  sourceFormat: 'xlsx' | 'csv' | 'tsv' | 'json' | 'zip' | 'api'
  sheetName?: string; headerRow: number; skipRows: number
  targetSchema: string; targetTable: string
  loadMode: 'append' | 'replace' | 'upsert'
  keyColumns?: string[]
  filenamePattern?: string
  strictColumns: boolean
  forbiddenColumns?: string[]
  fileEncoding: string
  jsonArrayPath?: string
  mappings: ImportSourceMapping[]
  createdAt: string
}

export interface ImportSourceMapping {
  id: number; sourceColumn?: string; targetColumn: string
  dataType: 'string' | 'integer' | 'float' | 'date' | 'datetime' | 'boolean'
  nullable: boolean; dateFormat?: string; constValue?: string
}

export interface ImportSourceForm {
  name: string; description?: string
  datasourceId: number
  sourceFormat: 'xlsx' | 'csv' | 'tsv' | 'json' | 'zip' | 'api'
  sheetName?: string; headerRow: number; skipRows: number
  targetSchema: string; targetTable: string
  loadMode: 'append' | 'replace' | 'upsert'
  keyColumns?: string[]
  filenamePattern?: string
  strictColumns: boolean
  forbiddenColumns?: string[]
  fileEncoding: string
  jsonArrayPath?: string
  mappings: ImportSourceMappingForm[]
}

export interface ImportSourceMappingForm {
  sourceColumn?: string; targetColumn: string
  dataType: 'string' | 'integer' | 'float' | 'date' | 'datetime' | 'boolean'
  nullable: boolean; dateFormat?: string; constValue?: string
}

export interface ImportPreviewResponse {
  columns: string[]; rows: any[][]
}

export interface ImportUploadResult {
  logId: number; rowsTotal: number; rowsImported: number; rowsFailed: number
  status: 'success' | 'error'; errors: ImportErrorDetail[]
}

export interface ImportErrorDetail {
  rowNumber: number; columnName?: string; errorMessage: string
}

export interface ImportLog {
  id: number; sourceId: number; sourceName: string
  filename: string; uploadedBy?: string; uploadedAt: string
  rowsTotal?: number; rowsImported?: number; rowsFailed?: number
  status: 'validating' | 'valid' | 'importing' | 'success' | 'error'
  errorDetail?: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type ImportLogSortKey =
  | 'sourceName' | 'filename' | 'uploadedBy' | 'uploadedAt'
  | 'rowsTotal' | 'rowsImported' | 'rowsFailed' | 'status'

export interface ListLogsParams {
  page: number
  size: number
  sort: ImportLogSortKey
  sortDir: 'asc' | 'desc'
  sourceName?: string
  filename?: string
  uploadedBy?: string
  status?: string
}

export const importApi = {
  listSources: () =>
    api.get<ImportSource[]>('/import/sources').then(r => r.data),

  createSource: (data: ImportSourceForm) =>
    api.post<ImportSource>('/import/sources', data).then(r => r.data),

  updateSource: (id: number, data: ImportSourceForm) =>
    api.put<ImportSource>(`/import/sources/${id}`, data).then(r => r.data),

  deleteSource: (id: number) =>
    api.delete(`/import/sources/${id}`),

  preview: (id: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<ImportPreviewResponse>(`/import/sources/${id}/preview`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  upload: (id: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<ImportUploadResult>(`/import/sources/${id}/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  listLogs: (params: ListLogsParams) => {
    const query: Record<string, string> = {
      page: String(params.page),
      size: String(params.size),
      sort: params.sort,
      sortDir: params.sortDir,
    }
    if (params.sourceName) query.sourceName = params.sourceName
    if (params.filename)   query.filename   = params.filename
    if (params.uploadedBy) query.uploadedBy = params.uploadedBy
    if (params.status)     query.status     = params.status
    return api.get<PageResponse<ImportLog>>('/import/logs', { params: query }).then(r => r.data)
  },

  getLogErrors: (id: number) =>
    api.get<ImportErrorDetail[]>(`/import/logs/${id}/errors`).then(r => r.data),
}
