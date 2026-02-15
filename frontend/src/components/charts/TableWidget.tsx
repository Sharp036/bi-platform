import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { WidgetData } from '@/types'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

const ROW_HEIGHT = 33 // px per row (text-sm + py-2)
const HEADER_HEIGHT = 37 // sticky header
const FOOTER_HEIGHT = 36 // pagination bar + stats + controls

interface Props {
  data: WidgetData
  title?: string
  chartConfig?: string
  onRowClick?: (row: Record<string, unknown>) => void
  clickable?: boolean
}

function parseConfig(raw?: string): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(cols: string[], rows: Record<string, unknown>[], filename: string) {
  const escape = (v: unknown) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.map(c => escape(c)).join(',')
  const body = rows.map(row => cols.map(c => escape(row[c])).join(',')).join('\n')
  const csv = '\ufeff' + header + '\n' + body
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename + '.csv')
}

function exportXlsx(cols: string[], rows: Record<string, unknown>[], filename: string) {
  const data = rows.map(row => {
    const obj: Record<string, unknown> = {}
    cols.forEach(c => { obj[c] = row[c] ?? '' })
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data, { header: cols })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, filename + '.xlsx')
}

export default function TableWidget({ data, title, chartConfig, onRowClick, clickable }: Props) {
  const { t } = useTranslation()
  const config = parseConfig(chartConfig)
  const cols = data.columns || []
  const allRows = data.rows || []

  // Determine visible columns from config
  const visibleCols = Array.isArray(config.visibleColumns)
    ? (config.visibleColumns as string[]).filter(c => cols.includes(c))
    : cols

  // Configurable page size from chartConfig, 0 or undefined = auto
  const configPageSize = Number(config.tablePageSize) || 0

  const containerRef = useRef<HTMLDivElement>(null)
  const [autoPageSize, setAutoPageSize] = useState(20)
  const [userPageSize, setUserPageSize] = useState<number>(0) // 0 = use config/auto
  const [page, setPage] = useState(0)

  // Auto-calculate page size based on container height
  useEffect(() => {
    if (configPageSize > 0 || userPageSize > 0) return
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height
      const available = h - HEADER_HEIGHT - FOOTER_HEIGHT - (title ? 28 : 0)
      const rows = Math.max(5, Math.floor(available / ROW_HEIGHT))
      setAutoPageSize(rows)
      setPage(0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [title, configPageSize, userPageSize])

  const pageSize = userPageSize > 0 ? userPageSize : configPageSize > 0 ? configPageSize : autoPageSize

  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize))
  const safeePage = Math.min(page, totalPages - 1)
  const pageRows = allRows.slice(safeePage * pageSize, (safeePage + 1) * pageSize)

  const goTo = useCallback((p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)))
  }, [totalPages])

  const handlePageSizeChange = useCallback((val: string) => {
    const n = Number(val)
    setUserPageSize(n)
    setPage(0)
  }, [])

  const filename = (title || 'data').replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, '_')

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {title && <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">{title}</h3>}
      <div className="flex-1 overflow-auto rounded-lg border border-surface-200 dark:border-dark-surface-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-100 dark:bg-dark-surface-100">
            <tr>
              {visibleCols.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-dark-surface-100">
            {pageRows.map((row, i) => (
              <tr
                key={safeePage * pageSize + i}
                onClick={onRowClick ? () => onRowClick(row as Record<string, unknown>) : undefined}
                className={`hover:bg-surface-50 dark:hover:bg-dark-surface-50/50 transition-colors ${
                  clickable ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20' : ''
                }`}
              >
                {visibleCols.map((col) => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {row[col] != null ? String(row[col]) : <span className="text-slate-400">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {allRows.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-400">{t('common.no_data')}</div>
        )}
      </div>
      {/* Footer: stats + page size + export + pagination */}
      <div className="flex items-center justify-between mt-1 px-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {data.rowCount} {t('common.rows')} · {data.executionMs}ms
          </span>
          <select
            value={userPageSize || ''}
            onChange={e => handlePageSizeChange(e.target.value)}
            className="text-[10px] border border-surface-200 dark:border-dark-surface-100 rounded px-1 py-0.5 bg-white dark:bg-dark-surface-200 text-slate-600 dark:text-slate-300"
          >
            <option value="0">{t('common.pagination.auto')}</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="500">500</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          {allRows.length > 0 && (
            <>
              <button
                onClick={() => exportCsv(visibleCols, allRows as Record<string, unknown>[], filename)}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100 text-slate-500 dark:text-slate-400 flex items-center gap-0.5"
                title={t('common.export_csv')}
              >
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={() => exportXlsx(visibleCols, allRows as Record<string, unknown>[], filename)}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100 text-slate-500 dark:text-slate-400 flex items-center gap-0.5"
                title={t('common.export_excel')}
              >
                <Download className="w-3 h-3" /> Excel
              </button>
            </>
          )}
          {totalPages > 1 && (
            <>
              <button
                onClick={() => goTo(safeePage - 1)}
                disabled={safeePage === 0}
                className="p-0.5 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[60px] text-center">
                {t('common.pagination.page_of', { current: safeePage + 1, total: totalPages })}
              </span>
              <button
                onClick={() => goTo(safeePage + 1)}
                disabled={safeePage >= totalPages - 1}
                className="p-0.5 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
