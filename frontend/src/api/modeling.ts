import api from '@/api/client'

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface DataModelItem {
  id: number; name: string; description: string | null
  datasourceId: number; datasourceName: string | null
  ownerId: number; isPublished: boolean
  tableCount: number; fieldCount: number; relationshipCount: number
  createdAt: string; updatedAt: string
}

export interface ModelFieldItem {
  id: number; modelTableId: number; tableAlias: string | null
  columnName: string | null; fieldRole: string
  label: string; description: string | null
  dataType: string | null; aggregation: string | null
  expression: string | null; format: string | null
  hidden: boolean; sortOrder: number; createdAt: string
}

export interface ModelTableItem {
  id: number; modelId: number; tableSchema: string | null
  tableName: string; alias: string
  label: string | null; description: string | null
  isPrimary: boolean; sqlExpression: string | null
  sortOrder: number; fields: ModelFieldItem[]; createdAt: string
}

export interface ModelRelationshipItem {
  id: number; modelId: number
  leftTableId: number; leftTableAlias: string | null; leftColumn: string
  rightTableId: number; rightTableAlias: string | null; rightColumn: string
  joinType: string; label: string | null
  isActive: boolean; createdAt: string
}

export interface DataModelDetail {
  id: number; name: string; description: string | null
  datasourceId: number; datasourceName: string | null
  ownerId: number; isPublished: boolean
  tables: ModelTableItem[]; relationships: ModelRelationshipItem[]
  createdAt: string; updatedAt: string
}

export interface ExploreResult {
  sql: string; columns: string[]
  rows: Record<string, unknown>[]; rowCount: number; executionMs: number
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

export const modelingApi = {
  // Schema (for auto-import)
  getSchema: (datasourceId: number) =>
    api.get<{ tables: { name: string; schema: string; columns: { name: string; type: string }[] }[] }>(`/schema/datasources/${datasourceId}`).then(r => r.data),

  // Models
  listModels: () =>
    api.get<DataModelItem[]>('/modeling/models').then(r => r.data),

  getModel: (id: number) =>
    api.get<DataModelDetail>(`/modeling/models/${id}`).then(r => r.data),

  createModel: (data: { name: string; description?: string; datasourceId: number }) =>
    api.post<DataModelItem>('/modeling/models', data).then(r => r.data),

  updateModel: (id: number, data: { name?: string; description?: string; isPublished?: boolean }) =>
    api.put<DataModelItem>(`/modeling/models/${id}`, data).then(r => r.data),

  deleteModel: (id: number) =>
    api.delete(`/modeling/models/${id}`),

  // Tables
  addTable: (modelId: number, data: { tableName: string; alias: string; tableSchema?: string; label?: string; isPrimary?: boolean }) =>
    api.post<ModelTableItem>(`/modeling/models/${modelId}/tables`, data).then(r => r.data),

  removeTable: (tableId: number) =>
    api.delete(`/modeling/tables/${tableId}`),

  // Fields
  addField: (tableId: number, data: { columnName?: string; fieldRole?: string; label: string; dataType?: string; aggregation?: string; expression?: string }) =>
    api.post<ModelFieldItem>(`/modeling/tables/${tableId}/fields`, data).then(r => r.data),

  updateField: (fieldId: number, data: { columnName?: string; fieldRole?: string; label: string; dataType?: string; aggregation?: string; expression?: string; hidden?: boolean }) =>
    api.put<ModelFieldItem>(`/modeling/fields/${fieldId}`, data).then(r => r.data),

  removeField: (fieldId: number) =>
    api.delete(`/modeling/fields/${fieldId}`),

  // Relationships
  addRelationship: (modelId: number, data: { leftTableId: number; leftColumn: string; rightTableId: number; rightColumn: string; joinType?: string; label?: string }) =>
    api.post<ModelRelationshipItem>(`/modeling/models/${modelId}/relationships`, data).then(r => r.data),

  removeRelationship: (relId: number) =>
    api.delete(`/modeling/relationships/${relId}`),

  // Auto-Import
  autoImport: (modelId: number, data: { tableNames: string[]; tableSchema?: string; detectRelationships?: boolean }) =>
    api.post<DataModelDetail>(`/modeling/models/${modelId}/auto-import`, data).then(r => r.data),

  // Explore
  explore: (data: { modelId: number; fieldIds: number[]; filters?: { fieldId: number; operator: string; value?: string; values?: string[] }[]; sorts?: { fieldId: number; direction?: string }[]; limit?: number }) =>
    api.post<ExploreResult>('/modeling/explore', data).then(r => r.data),
}
