import api from '@/api/client'

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface GlobalFilterConfig {
  id: number
  reportId: number
  widgetId: number
  isFilterSource: boolean
  filterField: string | null
  excludedTargets: string | null
  isEnabled: boolean
  createdAt: string
}

export interface ParameterControlConfig {
  id: number
  reportId: number
  parameterName: string
  controlType: string    // INPUT, DROPDOWN, SLIDER, RADIO, DATE_PICKER, MULTI_CHECKBOX
  datasourceId: number | null
  optionsQuery: string | null
  sliderMin: number | null
  sliderMax: number | null
  sliderStep: number | null
  config: Record<string, unknown>
  sortOrder: number
  createdAt: string
}

export interface ButtonConfig {
  buttonType: string     // NAVIGATE, SHOW_HIDE, FILTER, EXPORT, URL, RUN_JOB
  label: string
  labelActive?: string   // Label when toggled on (SHOW_HIDE)
  icon?: string
  color?: string
  size?: string          // small, medium, large
  targetReportId?: number
  targetParams?: Record<string, string>
  toggleWidgetIds?: number[]
  filterField?: string
  filterValue?: string
  exportFormat?: string
  url?: string
  openInNewTab?: boolean
  // RUN_JOB: the server starts the job (Airflow DAG) with the report parameters
  jobId?: string
  jobParams?: string[]   // report parameters sent to the job, all when empty
  jobUserParam?: string  // job parameter that receives the user name
  jobEmailParam?: string // job parameter that receives the user's email when empty
  confirmText?: string   // question shown before the start
}

export interface RunJobResponse {
  jobId: string
  runId: string
  state: string | null
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

export const controlsApi = {
  // Global Filters
  getFilters: (reportId: number) =>
    api.get<GlobalFilterConfig[]>(`/controls/filters/${reportId}`).then(r => r.data),

  getActiveFilters: (reportId: number) =>
    api.get<GlobalFilterConfig[]>(`/controls/filters/${reportId}/active`).then(r => r.data),

  getFilterSources: (reportId: number) =>
    api.get<GlobalFilterConfig[]>(`/controls/filters/${reportId}/sources`).then(r => r.data),

  saveFilter: (data: {
    reportId: number; widgetId: number; isFilterSource: boolean;
    filterField?: string; excludedTargets?: string; isEnabled?: boolean
  }) => api.post<GlobalFilterConfig>('/controls/filters', data).then(r => r.data),

  deleteFilter: (reportId: number, widgetId: number) =>
    api.delete(`/controls/filters/${reportId}/${widgetId}`),

  // Parameter Controls
  getParameterControls: (reportId: number) =>
    api.get<ParameterControlConfig[]>(`/controls/parameters/${reportId}`).then(r => r.data),

  saveParameterControl: (data: {
    reportId: number; parameterName: string; controlType: string;
    datasourceId?: number; optionsQuery?: string;
    sliderMin?: number; sliderMax?: number; sliderStep?: number;
    config?: Record<string, unknown>; sortOrder?: number
  }) => api.post<ParameterControlConfig>('/controls/parameters', data).then(r => r.data),

  deleteParameterControl: (reportId: number, parameterName: string) =>
    api.delete(`/controls/parameters/${reportId}/${parameterName}`),

  loadOptions: (reportId: number, parameterName: string, parentValues?: Record<string, string>) =>
    api.get<{ parameterName: string; options: string[]; hasMore: boolean; columnName: string | null }>(
      `/controls/parameters/${reportId}/${parameterName}/options`,
      { params: parentValues }
    ).then(r => r.data),

  // RUN_JOB buttons
  runJob: (reportId: number, widgetId: number, parameters: Record<string, unknown>) =>
    api.post<RunJobResponse>(`/reports/${reportId}/widgets/${widgetId}/run-job`, { parameters }).then(r => r.data),

  searchOptions: (reportId: number, parameterName: string, q: string, column: string, limit = 50, parentValues?: Record<string, string>) =>
    api.get<{ parameterName: string; options: string[]; hasMore: boolean; columnName: string | null }>(
      `/controls/parameters/${reportId}/${parameterName}/search`,
      { params: { q, column, limit, ...parentValues } }
    ).then(r => r.data),
}
