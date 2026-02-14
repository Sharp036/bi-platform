import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { modelingApi, type DataModelDetail, type ModelFieldItem, type ExploreResult } from '@/api/modeling'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import TableWidget from '@/components/charts/TableWidget'
import {
  Play, X, ArrowUpDown, Filter, GripVertical, ChevronDown,
  Type, Hash, Calendar, Table2, Code2, Boxes
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_COLORS: Record<string, string> = {
  DIMENSION: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  MEASURE: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  TIME_DIMENSION: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}
const ROLE_ICONS: Record<string, typeof Type> = { DIMENSION: Type, MEASURE: Hash, TIME_DIMENSION: Calendar }

interface ExploreFilterState {
  fieldId: number; operator: string; value: string; label: string
}

interface ExploreSortState {
  fieldId: number; direction: string; label: string
}

export default function ExplorePage() {
  const { modelId } = useParams<{ modelId: string }>()
  const mid = Number(modelId)

  const [model, setModel] = useState<DataModelDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFieldIds, setSelectedFieldIds] = useState<number[]>([])
  const [filters, setFilters] = useState<ExploreFilterState[]>([])
  const [sorts, setSorts] = useState<ExploreSortState[]>([])
  const [limit, setLimit] = useState(1000)
  const [result, setResult] = useState<ExploreResult | null>(null)
  const [running, setRunning] = useState(false)
  const [showSql, setShowSql] = useState(false)
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    try {
      const m = await modelingApi.getModel(mid)
      setModel(m)
      setExpandedTables(new Set(m.tables.map(t => t.id)))
    } catch { toast.error('Failed to load model') }
    finally { setLoading(false) }
  }, [mid])

  useEffect(() => { load() }, [load])

  // All visible fields
  const allFields: (ModelFieldItem & { _tableName: string })[] = model
    ? model.tables.flatMap(t =>
        t.fields.filter(f => !f.hidden).map(f => ({ ...f, _tableName: t.label || t.tableName }))
      )
    : []

  const fieldById = (id: number) => allFields.find(f => f.id === id)

  const toggleField = (fieldId: number) => {
    setSelectedFieldIds(prev =>
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    )
  }

  const removeSelectedField = (fieldId: number) => {
    setSelectedFieldIds(prev => prev.filter(id => id !== fieldId))
    setFilters(prev => prev.filter(f => f.fieldId !== fieldId))
    setSorts(prev => prev.filter(s => s.fieldId !== fieldId))
  }

  const addFilter = (fieldId: number) => {
    const f = fieldById(fieldId)
    if (!f) return
    setFilters(prev => [...prev, { fieldId, operator: 'EQ', value: '', label: f.label }])
  }

  const removeFilter = (idx: number) => setFilters(prev => prev.filter((_, i) => i !== idx))

  const updateFilter = (idx: number, patch: Partial<ExploreFilterState>) => {
    setFilters(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  const addSort = (fieldId: number) => {
    const f = fieldById(fieldId)
    if (!f) return
    setSorts(prev => [...prev, { fieldId, direction: 'ASC', label: f.label }])
  }

  const removeSort = (idx: number) => setSorts(prev => prev.filter((_, i) => i !== idx))

  const toggleSortDir = (idx: number) => {
    setSorts(prev => prev.map((s, i) => i === idx ? { ...s, direction: s.direction === 'ASC' ? 'DESC' : 'ASC' } : s))
  }

  const handleRun = async () => {
    if (selectedFieldIds.length === 0) { toast.error('Select at least one field'); return }
    setRunning(true)
    try {
      const res = await modelingApi.explore({
        modelId: mid,
        fieldIds: selectedFieldIds,
        filters: filters.filter(f => f.value.trim() || f.operator === 'IS_NULL' || f.operator === 'IS_NOT_NULL')
          .map(f => ({ fieldId: f.fieldId, operator: f.operator, value: f.value || undefined })),
        sorts: sorts.map(s => ({ fieldId: s.fieldId, direction: s.direction })),
        limit,
      })
      setResult(res)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Query failed'
      toast.error(msg)
    } finally { setRunning(false) }
  }

  if (loading || !model) return <LoadingSpinner />

  return (
    <div className="h-full flex flex-col max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Boxes className="w-5 h-5 text-violet-500" />
          Explore: {model.name}
        </h1>
        <div className="flex items-center gap-2">
          <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))}
                 className="input w-24 text-sm" min={1} max={50000} />
          <span className="text-xs text-slate-400">rows</span>
          <button onClick={handleRun} disabled={running || selectedFieldIds.length === 0} className="btn-primary">
            <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: field picker */}
        <div className="w-64 flex-shrink-0 overflow-y-auto space-y-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Fields</h3>
          {model.tables.map(table => (
            <div key={table.id}>
              <button onClick={() => {
                setExpandedTables(prev => {
                  const n = new Set(prev); n.has(table.id) ? n.delete(table.id) : n.add(table.id); return n
                })
              }} className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded hover:bg-surface-50 dark:hover:bg-dark-surface-50 text-sm">
                {expandedTables.has(table.id) ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 -rotate-90" />}
                <Table2 className="w-3.5 h-3.5 text-violet-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{table.label || table.tableName}</span>
              </button>
              {expandedTables.has(table.id) && (
                <div className="ml-4 space-y-0.5">
                  {table.fields.filter(f => !f.hidden).map(field => {
                    const Icon = ROLE_ICONS[field.fieldRole] || Type
                    const selected = selectedFieldIds.includes(field.id)
                    return (
                      <button key={field.id}
                              onClick={() => toggleField(field.id)}
                              className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                                selected
                                  ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-surface-50 dark:hover:bg-dark-surface-50'
                              }`}>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{field.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: query builder + results */}
        <div className="flex-1 flex flex-col min-w-0 gap-4">
          {/* Selected fields */}
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selected Columns</h3>
            {selectedFieldIds.length === 0 ? (
              <p className="text-sm text-slate-400">Click fields on the left to add columns</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedFieldIds.map(fid => {
                  const field = fieldById(fid)
                  if (!field) return null
                  const roleColor = ROLE_COLORS[field.fieldRole] || ROLE_COLORS.DIMENSION
                  return (
                    <span key={fid} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${roleColor}`}>
                      {field.label}
                      {field.fieldRole === 'MEASURE' && <span className="opacity-60">({field.aggregation || 'SUM'})</span>}
                      <button onClick={() => addFilter(fid)} className="ml-0.5 hover:opacity-70"><Filter className="w-3 h-3" /></button>
                      <button onClick={() => addSort(fid)} className="hover:opacity-70"><ArrowUpDown className="w-3 h-3" /></button>
                      <button onClick={() => removeSelectedField(fid)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Filters */}
          {filters.length > 0 && (
            <div className="card p-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filters
              </h3>
              <div className="space-y-2">
                {filters.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300 w-32 truncate">{f.label}</span>
                    <select value={f.operator} onChange={e => updateFilter(idx, { operator: e.target.value })}
                            className="input text-xs w-32">
                      <option value="EQ">=</option>
                      <option value="NEQ">≠</option>
                      <option value="GT">&gt;</option>
                      <option value="GTE">≥</option>
                      <option value="LT">&lt;</option>
                      <option value="LTE">≤</option>
                      <option value="LIKE">LIKE</option>
                      <option value="IS_NULL">IS NULL</option>
                      <option value="IS_NOT_NULL">IS NOT NULL</option>
                    </select>
                    {!['IS_NULL', 'IS_NOT_NULL'].includes(f.operator) && (
                      <input value={f.value} onChange={e => updateFilter(idx, { value: e.target.value })}
                             placeholder="Value" className="input text-xs flex-1" />
                    )}
                    <button onClick={() => removeFilter(idx)} className="btn-ghost p-1"><X className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sorts */}
          {sorts.length > 0 && (
            <div className="card p-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort
              </h3>
              <div className="flex flex-wrap gap-2">
                {sorts.map((s, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-surface-200 dark:border-dark-surface-100 text-xs">
                    {s.label}
                    <button onClick={() => toggleSortDir(idx)} className="font-bold text-violet-600 dark:text-violet-400 hover:opacity-70">
                      {s.direction === 'ASC' ? '↑' : '↓'}
                    </button>
                    <button onClick={() => removeSort(idx)} className="hover:opacity-70"><X className="w-3 h-3 text-red-500" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SQL preview */}
          {result && (
            <div>
              <button onClick={() => setShowSql(!showSql)} className="btn-ghost text-xs mb-1">
                <Code2 className="w-3.5 h-3.5" /> {showSql ? 'Hide SQL' : 'Show SQL'}
              </button>
              {showSql && (
                <pre className="card p-3 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {result.sql}
                </pre>
              )}
            </div>
          )}

          {/* Results table */}
          {result && (
            <div className="card flex-1 min-h-0 overflow-hidden">
              <div className="px-3 py-2 border-b border-surface-100 dark:border-dark-surface-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">{result.rowCount} rows · {result.executionMs}ms</span>
              </div>
              <div className="h-full overflow-auto" style={{ maxHeight: '500px' }}>
                <TableWidget data={{ columns: result.columns, rows: result.rows, rowCount: result.rowCount, executionMs: result.executionMs }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
