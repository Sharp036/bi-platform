import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MoreVertical, Code, Table, X, Copy, Check, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Play } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { WidgetData } from '@/types'
import { queryApi } from '@/api/queries'

interface Props {
  rawSql?: string
  datasourceId?: number
  data?: WidgetData
  title?: string
  parameters?: Record<string, unknown>
}

export default function WidgetContextMenu({ rawSql, datasourceId, data, title, parameters }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<'query' | 'table' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const resolvedSql = useMemo(() => {
    if (!rawSql) return ''
    if (!parameters || Object.keys(parameters).length === 0) return rawSql
    let sql = rawSql
    for (const [key, val] of Object.entries(parameters)) {
      if (val == null || val === '') continue
      const pattern = new RegExp(`:${key}(?![a-zA-Z0-9_])`, 'g')
      const replacement = typeof val === 'number' ? String(val) : `'${String(val).replace(/'/g, "''")}'`
      sql = sql.replace(pattern, replacement)
    }
    return sql
  }, [rawSql, parameters])

  const hasQuery = !!rawSql
  const hasData = data && data.columns.length > 0

  if (!hasQuery && !hasData) return null

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="p-1 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title={t('widget_menu.title')}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-surface-50 rounded-xl shadow-xl border border-surface-200 dark:border-dark-surface-100 py-1 z-50">
            {hasQuery && (
              <button
                onClick={() => { setOpen(false); setModal('query') }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
              >
                <Code className="w-4 h-4 text-blue-500" />
                {t('widget_menu.view_query')}
              </button>
            )}
            {hasData && (
              <button
                onClick={() => { setOpen(false); setModal('table') }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
              >
                <Table className="w-4 h-4 text-emerald-500" />
                {t('widget_menu.view_as_table')}
              </button>
            )}
          </div>
        )}
      </div>

      {modal === 'query' && rawSql && createPortal(
        <QueryModal sql={resolvedSql} datasourceId={datasourceId} title={title} onClose={() => setModal(null)} />,
        document.body
      )}
      {modal === 'table' && data && createPortal(
        <TableModal data={data} title={title} onClose={() => setModal(null)} />,
        document.body
      )}
    </>
  )
}

function QueryModal({ sql, datasourceId, title, onClose }: { sql: string; datasourceId?: number; title?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [editableSql, setEditableSql] = useState(sql)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number; executionMs: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editableSql).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [editableSql])

  const handleExecute = useCallback(async () => {
    if (!datasourceId || !editableSql.trim()) return
    setExecuting(true)
    setError(null)
    try {
      const res = await queryApi.executeAdHoc({ datasourceId, sql: editableSql, limit: 1000 })
      const cols = (res.columns || []).map((c: string | { name: string }) => typeof c === 'string' ? c : c.name)
      setResult({ columns: cols, rows: res.rows || [], rowCount: res.rowCount || res.rows?.length || 0, executionMs: res.executionTimeMs || 0 })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('widget_menu.execute_failed'))
    } finally {
      setExecuting(false)
    }
  }, [datasourceId, editableSql, t])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleExecute()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, handleExecute])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-dark-surface-100">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">
            {t('widget_menu.view_query')}{title ? ` - ${title}` : ''}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="btn-secondary text-xs px-2.5 py-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t('widget_menu.copied') : t('common.copy')}
            </button>
            {datasourceId && (
              <button onClick={handleExecute} disabled={executing} className="btn-primary text-xs px-2.5 py-1.5">
                <Play className="w-3.5 h-3.5" />
                {executing ? t('widget_menu.executing') : t('widget_menu.execute')}
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <textarea
            value={editableSql}
            onChange={e => setEditableSql(e.target.value)}
            className="w-full text-sm font-mono text-slate-700 dark:text-slate-300 bg-surface-50 dark:bg-dark-surface-100 p-4 resize-none border-b border-surface-200 dark:border-dark-surface-100 focus:outline-none"
            style={{ minHeight: '120px', maxHeight: '40vh' }}
            spellCheck={false}
          />
          {error && (
            <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              {error}
            </div>
          )}
          {result && (
            <div className="overflow-auto flex-1">
              <div className="px-4 py-1 text-xs text-slate-400 border-b border-surface-200 dark:border-dark-surface-100">
                {result.rowCount} {t('widget_menu.rows')} / {result.executionMs}ms
              </div>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-50 dark:bg-dark-surface-100">
                  <tr>
                    {result.columns.map(col => (
                      <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-surface-200 dark:border-dark-surface-100 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((row, i) => (
                    <tr key={i} className="border-b border-surface-100 dark:border-dark-surface-100 hover:bg-surface-50 dark:hover:bg-dark-surface-100/50">
                      {result.columns.map(col => (
                        <td key={col} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[300px] truncate" title={formatCell(row[col])}>
                          {formatCell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!result && !error && (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 p-4">
              {datasourceId ? t('widget_menu.execute_hint') : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TableModal({ data, title, onClose }: { data: WidgetData; title?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const filename = (title || 'data').replace(/[<>:"/\\|?*]/g, '_')

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortCol) return data.rows
    return [...data.rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const na = Number(av), nb = Number(bv)
      const bothNum = !isNaN(na) && !isNaN(nb)
      const cmp = bothNum ? na - nb : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data.rows, sortCol, sortDir])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const toTsv = useCallback(() => {
    const header = data.columns.join('\t')
    const body = data.rows.map(row => data.columns.map(c => formatCell(row[c])).join('\t')).join('\n')
    return header + '\n' + body
  }, [data])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(toTsv()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [toTsv])

  const handleCsv = useCallback(() => {
    const escapeCsv = (v: unknown) => {
      const s = formatCell(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = data.columns.map(c => escapeCsv(c)).join(',')
    const body = data.rows.map(row => data.columns.map(c => escapeCsv(row[c])).join(',')).join('\n')
    const csv = '\ufeff' + header + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, filename + '.csv')
  }, [data, filename])

  const handleExcel = useCallback(() => {
    const normalized = data.rows.map(row => {
      const out: Record<string, unknown> = {}
      for (const col of data.columns) {
        const v = row[col]
        if (typeof v === 'string' && v.length > 0) {
          const n = Number(v)
          if (!isNaN(n) && isFinite(n)) { out[col] = n; continue }
        }
        out[col] = v
      }
      return out
    })
    const ws = XLSX.utils.json_to_sheet(normalized, { header: data.columns })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, filename + '.xlsx')
  }, [data, filename])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col m-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-dark-surface-100">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">
            {t('widget_menu.view_as_table')}{title ? ` - ${title}` : ''}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {data.rowCount} {t('widget_menu.rows')}
              {data.executionMs > 0 && ` / ${data.executionMs}ms`}
            </span>
            <button onClick={handleCopy} className="btn-secondary text-xs px-2.5 py-1.5" title={t('widget_menu.copy_table')}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t('widget_menu.copied') : t('widget_menu.copy_table')}
            </button>
            <button onClick={handleCsv} className="btn-secondary text-xs px-2.5 py-1.5" title="CSV">
              <FileText className="w-3.5 h-3.5" />
              CSV
            </button>
            <button onClick={handleExcel} className="btn-secondary text-xs px-2.5 py-1.5" title="Excel">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button onClick={onClose} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-50 dark:bg-dark-surface-100">
              <tr>
                {data.columns.map(col => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-surface-200 dark:border-dark-surface-100 whitespace-nowrap cursor-pointer select-none hover:bg-surface-100 dark:hover:bg-dark-surface-100/80 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {sortCol === col
                        ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                        : <ArrowUpDown className="w-3 h-3 opacity-30" />
                      }
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-surface-100 dark:border-dark-surface-100 hover:bg-surface-50 dark:hover:bg-dark-surface-100/50"
                >
                  {data.columns.map(col => (
                    <td
                      key={col}
                      className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[300px] truncate"
                      title={formatCell(row[col])}
                    >
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function formatCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 10 }) : String(v)
  }
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v)
    if (!isNaN(n) && isFinite(n) && String(n) !== v) {
      return n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 10 })
    }
  }
  return String(v)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
