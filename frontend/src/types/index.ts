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
  widgetId: number; widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE' | 'BUTTON'
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

// ── Export ──
export interface ExportStatusResponse {
  snapshotId: number
  status: string
  format: string
  downloadUrl: string | null
}

export interface EmailDeliveryResponse {
  success: boolean
  recipientCount: number
  message: string
}

// ── Embed ──
export interface EmbedToken {
  id: number
  reportId: number
  reportName: string | null
  token: string
  label: string | null
  parameters: Record<string, unknown>
  embedUrl: string
  expiresAt: string | null
  isActive: boolean
  allowedDomains: string | null
  createdAt: string
}

// ── Calculated Fields ──
export interface CalcField {
  id: number
  reportId: number
  name: string
  label: string | null
  expression: string
  resultType: 'NUMBER' | 'STRING' | 'DATE' | 'BOOLEAN'
  formatPattern: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CalcFieldCreateRequest {
  reportId: number
  name: string
  label?: string
  expression: string
  resultType?: CalcField['resultType']
  formatPattern?: string
}

export interface CalcFieldUpdateRequest {
  name?: string
  label?: string
  expression?: string
  resultType?: CalcField['resultType']
  isActive?: boolean
}

// ── Data Alerts ──
export interface DataAlert {
  id: number
  name: string
  description: string | null
  reportId: number
  widgetId: number | null
  conditionType: 'THRESHOLD' | 'CHANGE_PERCENT' | 'ANOMALY' | 'ROW_COUNT'
  fieldName: string
  operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ' | 'BETWEEN'
  thresholdValue: number | null
  thresholdHigh: number | null
  notificationType: 'IN_APP' | 'EMAIL' | 'WEBHOOK'
  recipients: string | null
  webhookUrl: string | null
  isActive: boolean
  lastCheckedAt: string | null
  lastTriggeredAt: string | null
  lastValue: number | null
  consecutiveTriggers: number
  checkIntervalMin: number
  createdAt: string
  updatedAt: string
}

export interface AlertCreateRequest {
  name: string
  description?: string
  reportId: number
  widgetId?: number
  fieldName: string
  operator?: DataAlert['operator']
  thresholdValue?: number
  thresholdHigh?: number
  checkIntervalMin?: number
}

export interface AlertUpdateRequest {
  name?: string
  operator?: DataAlert['operator']
  thresholdValue?: number
  isActive?: boolean
}

export interface AlertCheckResult {
  alertId: number
  triggered: boolean
  currentValue: number | null
  message: string
}

export interface AlertEvent {
  id: number
  alertId: number
  eventType: string
  fieldValue: number | null
  thresholdValue: number | null
  message: string | null
  notified: boolean
  createdAt: string
}

// ── Bookmarks ──
export interface BookmarkItem {
  id: number
  reportId: number
  name: string
  description: string | null
  parameters: Record<string, unknown>
  filters: Record<string, unknown>
  isDefault: boolean
  isShared: boolean
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface BookmarkCreateRequest {
  reportId: number
  name: string
  parameters?: Record<string, unknown>
  filters?: Record<string, unknown>
  isShared?: boolean
}

export interface BookmarkUpdateRequest {
  name?: string
  parameters?: Record<string, unknown>
  isDefault?: boolean
  isShared?: boolean
}

// ── Interactive Dashboard ──
export interface ChartLayerItem {
  id: number; widgetId: number; name: string; label?: string
  queryId?: number; datasourceId?: number; rawSql?: string
  chartType: string; axis: string; color?: string; opacity: number
  isVisible: boolean; sortOrder: number
  seriesConfig: Record<string, unknown>; categoryField?: string; valueField?: string
  createdAt: string
}
export interface ChartLayerRequest {
  widgetId: number; name: string; label?: string
  queryId?: number; datasourceId?: number; rawSql?: string
  chartType?: string; axis?: string; color?: string; opacity?: number
  isVisible?: boolean; sortOrder?: number
  seriesConfig?: Record<string, unknown>; categoryField?: string; valueField?: string
  paramMapping?: Record<string, unknown>
}

export interface DashboardActionItem {
  id: number; reportId: number; name: string
  actionType: string; triggerType: string
  sourceWidgetId?: number; targetWidgetIds?: string
  sourceField?: string; targetField?: string
  targetReportId?: number; urlTemplate?: string
  isActive: boolean; sortOrder: number
  config: Record<string, unknown>; createdAt: string
}
export interface DashboardActionRequest {
  reportId: number; name: string
  actionType?: string; triggerType?: string
  sourceWidgetId?: number; targetWidgetIds?: string
  sourceField?: string; targetField?: string
  targetReportId?: number; urlTemplate?: string
  config?: Record<string, unknown>
}

export interface VisibilityRuleItem {
  id: number; widgetId: number; ruleType: string
  parameterName?: string; operator: string; expectedValue?: string
  isActive: boolean; createdAt: string
}
export interface VisibilityRuleRequest {
  widgetId: number; ruleType?: string
  parameterName?: string; operator?: string; expectedValue?: string
}

export interface OverlayItem {
  id: number; reportId: number; overlayType: string
  content?: string | null
  positionX: number; positionY: number; width: number; height: number
  opacity: number; zIndex: number; linkUrl?: string | null
  isVisible: boolean; style: Record<string, unknown>; createdAt: string
}
export interface OverlayRequest {
  reportId: number; overlayType?: string
  content?: string | null
  positionX?: number; positionY?: number; width?: number; height?: number
  opacity?: number; zIndex?: number; linkUrl?: string | null
  isVisible?: boolean; style?: Record<string, unknown>
}

export interface InteractiveMeta {
  actions: DashboardActionItem[]
  visibilityRules: Record<number, VisibilityRuleItem[]>
  overlays: OverlayItem[]
  chartLayers: Record<number, ChartLayerItem[]>
}

export interface WidgetListItem {
  id: number; title?: string; widgetType: string
}