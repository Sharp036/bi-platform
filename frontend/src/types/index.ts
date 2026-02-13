// ── Auth ──
export interface LoginRequest { username: string; password: string }
export interface AuthResponse { accessToken: string; refreshToken: string; username: string; roles: string[] }
export interface User { username: string; roles: string[]; permissions: string[] }

// ── DataSource ──
export interface DataSource {
  id: number; name: string; description?: string; type: 'POSTGRESQL' | 'CLICKHOUSE'
  host: string; port: number; databaseName: string; username?: string
  isActive: boolean; createdAt: string; updatedAt: string
}
export interface DataSourceForm {
  name: string; description?: string; type: 'POSTGRESQL' | 'CLICKHOUSE'
  host: string; port: number; databaseName: string; username?: string; password?: string
}

// ── Query ──
export interface SavedQuery {
  id: number; name: string; description?: string
  datasourceId: number; datasourceName: string
  queryMode: 'RAW' | 'VISUAL'; sqlText: string
  isFavorite: boolean; executionCount: number
  lastExecutedAt?: string; updatedAt: string
}
export interface QueryResult {
  columns: ColumnMeta[]; rows: Record<string, unknown>[]
  rowCount: number; executionTimeMs: number; truncated: boolean
}
export interface ColumnMeta { name: string; type: string; nullable: boolean }

// ── Report ──
export interface Report {
  id: number; name: string; description?: string
  reportType: 'STANDARD' | 'TEMPLATE'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  isTemplate: boolean
  parameters: ReportParameter[]; widgets: Widget[]
  createdAt: string; updatedAt: string
}
export interface ReportParameter {
  id?: number; name: string; label?: string
  paramType: 'STRING' | 'NUMBER' | 'DATE' | 'DATE_RANGE' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN'
  defaultValue?: string; isRequired: boolean; config?: Record<string, unknown>
}
export interface Widget {
  widgetId: number; widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE'
  title?: string; chartConfig?: string; position?: string; style?: string
  queryId?: number; datasourceId?: number; rawSql?: string
}

// ── Rendered Report ──
export interface RenderReportResponse {
  reportId: number; reportName: string
  parameters: Record<string, unknown>
  widgets: RenderedWidget[]; executionMs: number
}
export interface RenderedWidget {
  widgetId: number; widgetType: string; title?: string
  chartConfig?: string; position?: string; style?: string
  data?: WidgetData; error?: string
}
export interface WidgetData {
  columns: string[]; rows: Record<string, unknown>[]
  rowCount: number; executionMs: number
}

// ── Dashboard ──
export interface Dashboard {
  id: number; name: string; description?: string
  isPublished: boolean; createdAt: string; updatedAt: string
}

// ── Schedule ──
export interface Schedule {
  id: number; reportId: number; reportName?: string
  cronExpression: string; isActive: boolean
  outputFormat: string; lastRunAt?: string
  lastStatus?: string; lastError?: string
}

// ── Common ──
export interface PageResponse<T> {
  content: T[]; totalElements: number; totalPages: number; page: number
}

// ── Scripts ──
export interface Script {
  id: number
  name: string
  description: string | null
  scriptType: 'TRANSFORM' | 'FORMAT' | 'EVENT' | 'LIBRARY'
  code: string
  isActive: boolean
  isLibrary: boolean
  tags: string[]
  config: Record<string, unknown>
  createdBy: number | null
  updatedBy: number | null
  createdAt: string
  updatedAt: string
}

export interface ScriptSummary {
  id: number
  name: string
  description: string | null
  scriptType: 'TRANSFORM' | 'FORMAT' | 'EVENT' | 'LIBRARY'
  isActive: boolean
  isLibrary: boolean
  tags: string[]
  updatedAt: string
}

export interface ScriptCreateRequest {
  name: string
  description?: string
  scriptType: Script['scriptType']
  code: string
  isLibrary?: boolean
  tags?: string[]
}

export interface ScriptUpdateRequest {
  name?: string
  description?: string
  scriptType?: Script['scriptType']
  code?: string
  isActive?: boolean
  isLibrary?: boolean
  tags?: string[]
}

export interface ScriptExecuteRequest {
  scriptId?: number
  code?: string
  input?: {
    columns: string[]
    rows: unknown[][]
    parameters: Record<string, unknown>
  }
  libraries?: number[]
}

export interface ScriptExecuteResponse {
  output: unknown
  columns: string[] | null
  rows: unknown[][] | null
  logs: string[]
  executionMs: number
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT'
}

export interface ScriptExecution {
  id: number
  scriptId: number | null
  scriptName: string | null
  contextType: string | null
  contextId: number | null
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT'
  executionMs: number | null
  inputRows: number | null
  outputRows: number | null
  errorMessage: string | null
  executedBy: string | null
  createdAt: string
}

// ── Drill-Down ──
export interface DrillAction {
  id: number
  sourceWidgetId: number
  targetReportId: number
  targetReportName: string | null
  actionType: 'DRILL_DOWN' | 'DRILL_THROUGH' | 'CROSS_LINK'
  label: string | null
  description: string | null
  paramMapping: Record<string, { source: string; value: string }>
  triggerType: 'ROW_CLICK' | 'CHART_CLICK' | 'BUTTON'
  openMode: 'REPLACE' | 'NEW_TAB'
  isActive: boolean
  sortOrder: number
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface DrillActionCreateRequest {
  sourceWidgetId: number
  targetReportId: number
  actionType?: DrillAction['actionType']
  label?: string
  description?: string
  paramMapping?: Record<string, { source: string; value: string }>
  triggerType?: DrillAction['triggerType']
  openMode?: DrillAction['openMode']
  sortOrder?: number
}

export interface DrillActionUpdateRequest {
  targetReportId?: number
  actionType?: DrillAction['actionType']
  label?: string
  paramMapping?: Record<string, { source: string; value: string }>
  triggerType?: DrillAction['triggerType']
  openMode?: DrillAction['openMode']
  isActive?: boolean
}

export interface DrillNavigateResponse {
  targetReportId: number
  targetReportName: string
  resolvedParameters: Record<string, unknown>
  openMode: 'REPLACE' | 'NEW_TAB'
  breadcrumbLabel: string
}