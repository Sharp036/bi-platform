import { useState, useEffect, useCallback } from 'react'
import { Code2, Play, Save, Plus, Trash2, BookOpen, Clock, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { scriptApi } from '@/api/scripts'
import type { Script, ScriptSummary, ScriptExecuteResponse } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import toast from 'react-hot-toast'

const SCRIPT_TYPES = [
  { value: 'TRANSFORM', label: 'Data Transform', desc: 'Pre/post-process query results' },
  { value: 'FORMAT', label: 'Conditional Format', desc: 'Dynamic cell/row styling' },
  { value: 'EVENT', label: 'Event Handler', desc: 'Chart onClick, onRender hooks' },
  { value: 'LIBRARY', label: 'Library', desc: 'Reusable helper functions' },
]

const SAMPLE_SCRIPTS: Record<string, string> = {
  TRANSFORM: `// Transform data: filter, map, aggregate
// 'data' is an array of objects (from query results)
// Call setOutput(newData) to return transformed data

var filtered = data.filter(function(row) {
  return row.amount > 100;
});

// Sort by amount descending
filtered.sort(function(a, b) {
  return b.amount - a.amount;
});

setOutput(filtered);`,

  FORMAT: `// Conditional formatting
// Return an array of style objects per row
var styles = data.map(function(row) {
  if (row.status === 'ERROR') return { color: '#ef4444', fontWeight: 'bold' };
  if (row.amount > 1000) return { color: '#22c55e' };
  return {};
});
setOutput(styles);`,

  EVENT: `// Chart event handler
// 'event' contains: { type, dataIndex, seriesName, value, name }
// 'params' contains report parameters

console.log('Clicked:', event.name, event.value);

// Example: set report parameter based on click
// report.setParameter('selectedItem', event.name);`,

  LIBRARY: `// Reusable helper functions
// This code is prepended to other scripts that include this library

function formatCurrency(value, currency) {
  currency = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency
  }).format(value);
}

function groupBy(arr, key) {
  return arr.reduce(function(acc, item) {
    var group = item[key] || 'Unknown';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

function sum(arr, key) {
  return arr.reduce(function(acc, item) {
    return acc + (Number(item[key]) || 0);
  }, 0);
}

function avg(arr, key) {
  return arr.length > 0 ? sum(arr, key) / arr.length : 0;
}`,
}

export default function ScriptEditorPage() {
  const [scripts, setScripts] = useState<ScriptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [script, setScript] = useState<Script | null>(null)
  const [filterType, setFilterType] = useState<string>('')
  const [search, setSearch] = useState('')

  // Editor state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [scriptType, setScriptType] = useState('TRANSFORM')
  const [isLibrary, setIsLibrary] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  // Execution
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ScriptExecuteResponse | null>(null)
  const [testInput, setTestInput] = useState('{\n  "columns": ["name", "amount", "status"],\n  "rows": [\n    ["Alice", 150, "OK"],\n    ["Bob", 50, "ERROR"],\n    ["Charlie", 1200, "OK"]\n  ],\n  "parameters": {}\n}')

  const loadScripts = useCallback(async () => {
    try {
      const data = await scriptApi.list({
        search: search || undefined,
        type: filterType || undefined,
        size: 100
      })
      setScripts(data.content)
    } catch {
      toast.error('Failed to load scripts')
    } finally {
      setLoading(false)
    }
  }, [search, filterType])

  useEffect(() => { loadScripts() }, [loadScripts])

  const loadScript = async (id: number) => {
    try {
      const s = await scriptApi.getById(id)
      setScript(s)
      setSelectedId(id)
      setName(s.name)
      setDescription(s.description || '')
      setCode(s.code)
      setScriptType(s.scriptType)
      setIsLibrary(s.isLibrary)
      setIsNew(false)
      setResult(null)
    } catch {
      toast.error('Failed to load script')
    }
  }

  const handleNew = () => {
    setSelectedId(null)
    setScript(null)
    setName('')
    setDescription('')
    setCode(SAMPLE_SCRIPTS.TRANSFORM)
    setScriptType('TRANSFORM')
    setIsLibrary(false)
    setIsNew(true)
    setResult(null)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!code.trim()) { toast.error('Code is required'); return }

    setSaving(true)
    try {
      if (isNew) {
        const created = await scriptApi.create({
          name, description, code,
          scriptType: scriptType as Script['scriptType'],
          isLibrary,
          tags: []
        })
        toast.success('Script created')
        setSelectedId(created.id)
        setIsNew(false)
        setScript(created)
      } else if (selectedId) {
        const updated = await scriptApi.update(selectedId, {
          name, description, code,
          scriptType: scriptType as Script['scriptType'],
          isLibrary
        })
        toast.success('Script saved')
        setScript(updated)
      }
      loadScripts()
    } catch {
      toast.error('Failed to save script')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (!confirm('Delete this script?')) return
    try {
      await scriptApi.delete(selectedId)
      toast.success('Script deleted')
      setSelectedId(null)
      setScript(null)
      setIsNew(false)
      loadScripts()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setResult(null)
    try {
      let input = undefined
      try {
        input = JSON.parse(testInput)
      } catch { /* no input */ }

      const res = await scriptApi.execute({
        scriptId: selectedId || undefined,
        code: isNew ? code : undefined,
        input
      })
      setResult(res)
      if (res.status === 'SUCCESS') toast.success(`Done in ${res.executionMs}ms`)
      else toast.error(res.logs?.[0] || 'Execution failed')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Execution failed'
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  const handleTypeChange = (type: string) => {
    setScriptType(type)
    setIsLibrary(type === 'LIBRARY')
    if (isNew && !code.trim() || code === SAMPLE_SCRIPTS[scriptType]) {
      setCode(SAMPLE_SCRIPTS[type] || '')
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Scripts</h1>
        <button onClick={handleNew} className="btn-primary">
          <Plus className="w-4 h-4" /> New Script
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left panel — Script list */}
        <div className="w-72 flex-shrink-0 flex flex-col card p-3">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search scripts..." className="input mb-2 text-sm"
          />
          <select
            value={filterType} onChange={e => setFilterType(e.target.value)}
            className="input mb-2 text-sm"
          >
            <option value="">All types</option>
            {SCRIPT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="flex-1 overflow-y-auto space-y-1">
            {loading ? <LoadingSpinner /> : scripts.length === 0 ? (
              <EmptyState icon={<Code2 className="w-8 h-8" />} message="No scripts yet" />
            ) : scripts.map(s => (
              <button
                key={s.id}
                onClick={() => loadScript(s.id)}
                className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                  selectedId === s.id
                    ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800'
                    : 'hover:bg-slate-50 dark:hover:bg-dark-surface-2'
                }`}
              >
                <div className="flex items-center gap-2">
                  {s.isLibrary ? (
                    <BookOpen className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  ) : (
                    <Code2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                  )}
                  <span className="font-medium truncate text-slate-700 dark:text-slate-200">
                    {s.name}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-dark-surface-3 rounded">
                    {s.scriptType}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — Editor */}
        {(selectedId || isNew) ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Script name" className="input flex-1 min-w-48"
              />
              <select
                value={scriptType} onChange={e => handleTypeChange(e.target.value)}
                className="input w-44"
              >
                {SCRIPT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button onClick={handleRun} disabled={running || !code.trim()} className="btn-primary">
                <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run'}
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-secondary">
                <Save className="w-4 h-4" /> Save
              </button>
              {selectedId && (
                <button onClick={handleDelete} className="btn-danger">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Description */}
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)" className="input mb-3 text-sm"
            />

            {/* Code editor + test panels */}
            <div className="flex-1 flex gap-3 min-h-0">
              {/* Code */}
              <div className="flex-1 flex flex-col min-w-0">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Code</label>
                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun() }
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
                    // Tab key inserts 2 spaces
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const target = e.target as HTMLTextAreaElement
                      const start = target.selectionStart
                      const end = target.selectionEnd
                      setCode(code.substring(0, start) + '  ' + code.substring(end))
                      setTimeout(() => { target.selectionStart = target.selectionEnd = start + 2 }, 0)
                    }
                  }}
                  className="flex-1 font-mono text-sm p-3 rounded-lg border border-slate-200 dark:border-dark-surface-3
                    bg-slate-50 dark:bg-dark-surface-1 text-slate-800 dark:text-slate-200
                    resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  spellCheck={false}
                  placeholder="// Write your JavaScript here..."
                />
                <div className="mt-1 text-xs text-slate-400">
                  Ctrl+Enter to run • Ctrl+S to save • Tab inserts spaces
                </div>
              </div>

              {/* Test input + output */}
              <div className="w-80 flex-shrink-0 flex flex-col gap-3">
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Test Input (JSON)
                  </label>
                  <textarea
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    className="flex-1 font-mono text-xs p-2 rounded-lg border border-slate-200 dark:border-dark-surface-3
                      bg-slate-50 dark:bg-dark-surface-1 text-slate-700 dark:text-slate-300 resize-none
                      focus:outline-none focus:ring-2 focus:ring-brand-500"
                    spellCheck={false}
                  />
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Output
                  </label>
                  <div className="flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-dark-surface-3
                    bg-slate-50 dark:bg-dark-surface-1 p-2">
                    {result ? (
                      <div className="text-xs font-mono">
                        <div className={`flex items-center gap-1 mb-2 ${
                          result.status === 'SUCCESS' ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {result.status === 'SUCCESS' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{result.status} ({result.executionMs}ms)</span>
                        </div>
                        {result.logs.length > 0 && (
                          <div className="mb-2 p-1.5 bg-slate-100 dark:bg-dark-surface-2 rounded text-slate-600 dark:text-slate-300">
                            {result.logs.map((l, i) => <div key={i}>→ {l}</div>)}
                          </div>
                        )}
                        {result.columns && result.rows && (
                          <div className="overflow-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-dark-surface-3">
                                  {result.columns.map((c, i) => (
                                    <th key={i} className="p-1 text-slate-500">{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {result.rows.slice(0, 50).map((row, ri) => (
                                  <tr key={ri} className="border-b border-slate-100 dark:border-dark-surface-2">
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="p-1 text-slate-700 dark:text-slate-300">
                                        {cell === null ? <span className="text-slate-300">null</span> : String(cell)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {result.rows.length > 50 && (
                              <div className="mt-1 text-slate-400">
                                Showing 50 of {result.rows.length} rows
                              </div>
                            )}
                          </div>
                        )}
                        {result.output && !result.columns && (
                          <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                            {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 flex items-center justify-center h-full">
                        Run script to see output
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Code2 className="w-12 h-12" />}
              message="Select a script or create a new one"
            />
          </div>
        )}
      </div>
    </div>
  )
}
