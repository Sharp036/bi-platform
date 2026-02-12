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
