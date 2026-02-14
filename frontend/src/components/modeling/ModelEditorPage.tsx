import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { modelingApi, type DataModelDetail, type ModelTableItem, type ModelFieldItem, type ModelRelationshipItem } from '@/api/modeling'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  Boxes, Plus, Trash2, ChevronDown, ChevronRight, ArrowRight,
  Download, Play, Table2, Hash, Calendar, Type, ToggleLeft, Eye, EyeOff,
  Link2, Unlink
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_ICONS: Record<string, typeof Type> = { DIMENSION: Type, MEASURE: Hash, TIME_DIMENSION: Calendar }
const ROLE_COLORS: Record<string, string> = {
  DIMENSION: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30',
  MEASURE: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30',
  TIME_DIMENSION: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
}

export default function ModelEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const modelId = Number(id)

  const [model, setModel] = useState<DataModelDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set())

  // Schema for auto-import
  const [schemaTables, setSchemaTables] = useState<string[]>([])
  const [selectedImport, setSelectedImport] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    try {
      const m = await modelingApi.getModel(modelId)
      setModel(m)
      // Auto-expand all tables on first load
      if (expandedTables.size === 0) {
        setExpandedTables(new Set(m.tables.map(t => t.id)))
      }
    } catch { toast.error('Failed to load model') }
    finally { setLoading(false) }
  }, [modelId])

  useEffect(() => { load() }, [load])

  // ─── Schema loading for import ───
  const loadSchema = async () => {
    if (!model) return
    try {
      const res = await modelingApi.getSchema(model.datasourceId)
      const existing = new Set(model.tables.map(t => t.tableName))
      setSchemaTables(res.tables.map((t: { name: string }) => t.name).filter((n: string) => !existing.has(n)))
      setShowImport(true)
    } catch { toast.error('Failed to load schema') }
  }

  const handleImport = async () => {
    if (selectedImport.size === 0) return
    setImporting(true)
    try {
      await modelingApi.autoImport(modelId, {
        tableNames: Array.from(selectedImport),
        detectRelationships: true,
      })
      toast.success(`Imported ${selectedImport.size} table(s)`)
      setShowImport(false); setSelectedImport(new Set())
      load()
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  // ─── Table actions ───
  const handleRemoveTable = async (tableId: number) => {
    if (!confirm('Remove this table and all its fields?')) return
    try { await modelingApi.removeTable(tableId); toast.success('Table removed'); load() }
    catch { toast.error('Failed to remove') }
  }

  // ─── Field actions ───
  const handleToggleHidden = async (field: ModelFieldItem) => {
    try {
      await modelingApi.updateField(field.id, {
        columnName: field.columnName ?? undefined,
        fieldRole: field.fieldRole,
        label: field.label,
        dataType: field.dataType ?? undefined,
        aggregation: field.aggregation ?? undefined,
        expression: field.expression ?? undefined,
        hidden: !field.hidden,
      })
      load()
    } catch { toast.error('Failed to update') }
  }

  const handleChangeRole = async (field: ModelFieldItem, newRole: string) => {
    try {
      await modelingApi.updateField(field.id, {
        columnName: field.columnName ?? undefined,
        fieldRole: newRole,
        label: field.label,
        dataType: field.dataType ?? undefined,
        aggregation: newRole === 'MEASURE' ? (field.aggregation || 'SUM') : undefined,
        expression: field.expression ?? undefined,
        hidden: field.hidden,
      })
      load()
    } catch { toast.error('Failed to update') }
  }

  const handleChangeAggregation = async (field: ModelFieldItem, agg: string) => {
    try {
      await modelingApi.updateField(field.id, {
        columnName: field.columnName ?? undefined,
        fieldRole: field.fieldRole,
        label: field.label,
        dataType: field.dataType ?? undefined,
        aggregation: agg || undefined,
        expression: field.expression ?? undefined,
        hidden: field.hidden,
      })
      load()
    } catch { toast.error('Failed to update') }
  }

  // ─── Relationship actions ───
  const handleRemoveRelationship = async (relId: number) => {
    try { await modelingApi.removeRelationship(relId); toast.success('Removed'); load() }
    catch { toast.error('Failed to remove') }
  }

  const toggleTable = (tableId: number) => {
    setExpandedTables(prev => {
      const next = new Set(prev)
      next.has(tableId) ? next.delete(tableId) : next.add(tableId)
      return next
    })
  }

  if (loading || !model) return <LoadingSpinner />

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-violet-500" />
            {model.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {model.datasourceName} · {model.tables.length} tables · {model.relationships.length} relationships
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSchema} className="btn-secondary"><Download className="w-4 h-4" /> Import Tables</button>
          <button onClick={() => navigate(`/explore/${modelId}`)} className="btn-primary"><Play className="w-4 h-4" /> Explore</button>
        </div>
      </div>

      {/* Import modal */}
      {showImport && (
        <div className="card p-4 mb-6 border-2 border-violet-200 dark:border-violet-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Select tables to import</h3>
          {schemaTables.length === 0 ? (
            <p className="text-sm text-slate-500">All tables already imported</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3 max-h-48 overflow-y-auto">
                {schemaTables.map(name => (
                  <label key={name} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                    selectedImport.has(name)
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                      : 'border-surface-200 dark:border-dark-surface-100 text-slate-600 dark:text-slate-400 hover:bg-surface-50'
                  }`}>
                    <input type="checkbox" className="sr-only"
                           checked={selectedImport.has(name)}
                           onChange={() => {
                             setSelectedImport(prev => {
                               const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n
                             })
                           }} />
                    <Table2 className="w-3.5 h-3.5" />
                    {name}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedImport(new Set(schemaTables))} className="btn-ghost text-xs">Select All</button>
                <button onClick={() => setSelectedImport(new Set())} className="btn-ghost text-xs">Deselect All</button>
                <div className="flex-1" />
                <button onClick={() => setShowImport(false)} className="btn-secondary text-xs">Cancel</button>
                <button onClick={handleImport} disabled={importing || selectedImport.size === 0} className="btn-primary text-xs">
                  {importing ? 'Importing...' : `Import ${selectedImport.size} table(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tables & Fields (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tables & Fields</h2>

          {model.tables.length === 0 ? (
            <div className="card p-6 text-center text-slate-500">
              No tables yet. Click "Import Tables" to add tables from your datasource.
            </div>
          ) : model.tables.map(table => (
            <div key={table.id} className="card overflow-hidden">
              {/* Table header */}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-50 dark:bg-dark-surface-50 cursor-pointer"
                   onClick={() => toggleTable(table.id)}>
                <div className="flex items-center gap-2">
                  {expandedTables.has(table.id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <Table2 className="w-4 h-4 text-violet-500" />
                  <span className="font-medium text-slate-800 dark:text-white">{table.label || table.tableName}</span>
                  <span className="text-xs text-slate-400">{table.alias}</span>
                  {table.isPrimary && <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded">primary</span>}
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-slate-400 mr-2">{table.fields.length} fields</span>
                  <button onClick={() => handleRemoveTable(table.id)} className="btn-ghost p-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Fields */}
              {expandedTables.has(table.id) && (
                <div className="divide-y divide-surface-100 dark:divide-dark-surface-100">
                  {table.fields.map(field => {
                    const RoleIcon = ROLE_ICONS[field.fieldRole] || Type
                    const roleColor = ROLE_COLORS[field.fieldRole] || ROLE_COLORS.DIMENSION
                    return (
                      <div key={field.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${field.hidden ? 'opacity-50' : ''}`}>
                        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${roleColor}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-slate-800 dark:text-white">{field.label}</span>
                          {field.columnName && field.columnName !== field.label && (
                            <span className="text-xs text-slate-400 ml-2">{field.columnName}</span>
                          )}
                        </div>
                        <select value={field.fieldRole}
                                onChange={e => handleChangeRole(field, e.target.value)}
                                className="text-xs border border-surface-200 dark:border-dark-surface-100 rounded px-1.5 py-0.5 bg-white dark:bg-dark-surface-50 text-slate-600 dark:text-slate-300">
                          <option value="DIMENSION">Dimension</option>
                          <option value="MEASURE">Measure</option>
                          <option value="TIME_DIMENSION">Time</option>
                        </select>
                        {field.fieldRole === 'MEASURE' && (
                          <select value={field.aggregation || 'SUM'}
                                  onChange={e => handleChangeAggregation(field, e.target.value)}
                                  className="text-xs border border-surface-200 dark:border-dark-surface-100 rounded px-1.5 py-0.5 bg-white dark:bg-dark-surface-50 text-slate-600 dark:text-slate-300">
                            <option value="SUM">SUM</option>
                            <option value="AVG">AVG</option>
                            <option value="COUNT">COUNT</option>
                            <option value="COUNT_DISTINCT">COUNT DISTINCT</option>
                            <option value="MIN">MIN</option>
                            <option value="MAX">MAX</option>
                          </select>
                        )}
                        <span className="text-xs text-slate-400 w-16 text-right">{field.dataType}</span>
                        <button onClick={() => handleToggleHidden(field)} className="btn-ghost p-1" title={field.hidden ? 'Show' : 'Hide'}>
                          {field.hidden ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Relationships (1 col) */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Relationships</h2>

          {model.relationships.length === 0 ? (
            <div className="card p-4 text-center text-sm text-slate-500">
              <Unlink className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No relationships. Import tables with foreign keys to auto-detect.
            </div>
          ) : model.relationships.map(rel => (
            <div key={rel.id} className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-surface-100 dark:bg-dark-surface-100 text-slate-600 dark:text-slate-300">
                  {rel.joinType} JOIN
                </span>
                <button onClick={() => handleRemoveRelationship(rel.id)} className="btn-ghost p-1 text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-800 dark:text-white font-medium">{rel.leftTableAlias}</span>
                <span className="text-slate-400">.{rel.leftColumn}</span>
                <ArrowRight className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                <span className="text-slate-800 dark:text-white font-medium">{rel.rightTableAlias}</span>
                <span className="text-slate-400">.{rel.rightColumn}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
