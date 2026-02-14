import api from '@/api/client'

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface TemplateItem {
  id: number; name: string; description: string | null
  category: string | null; preview: string | null
  thumbnailUrl: string | null; widgetCount: number; createdAt: string
}

export interface ReportExportConfig {
  formatVersion: number; name: string; description: string | null
  reportType: string; layout: string; settings: string; category: string | null
  parameters: ParameterExportConfig[]; widgets: WidgetExportConfig[]
}

export interface ParameterExportConfig {
  name: string; label: string | null; paramType: string
  defaultValue: string | null; isRequired: boolean; sortOrder: number; config: string
}

export interface WidgetExportConfig {
  widgetType: string; title: string | null; rawSql: string | null
  chartConfig: string; position: string; style: string
  paramMapping: string; sortOrder: number; isVisible: boolean
}

export interface ImportResult {
  reportId: number; name: string; widgetCount: number; parameterCount: number
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

export const templateApi = {
  list: (category?: string) =>
    api.get<TemplateItem[]>('/templates', { params: { category } }).then(r => r.data),

  getCategories: () =>
    api.get<string[]>('/templates/categories').then(r => r.data),

  markAsTemplate: (reportId: number, category?: string, preview?: string) =>
    api.post<TemplateItem>(`/templates/${reportId}/mark`, null, { params: { category, preview } }).then(r => r.data),

  unmarkAsTemplate: (reportId: number) =>
    api.post(`/templates/${reportId}/unmark`),

  updateMeta: (id: number, data: { category?: string; preview?: string; thumbnailUrl?: string }) =>
    api.put(`/templates/${id}/meta`, data),

  exportReport: (reportId: number) =>
    api.get<ReportExportConfig>(`/templates/export/${reportId}`).then(r => r.data),

  importReport: (data: { config: ReportExportConfig; name?: string; datasourceId?: number; asTemplate?: boolean; folderId?: number }) =>
    api.post<ImportResult>('/templates/import', data).then(r => r.data),

  createFromTemplate: (templateId: number, name: string) =>
    api.post(`/reports/from-template/${templateId}`, null, { params: { name } }).then(r => r.data),
}
