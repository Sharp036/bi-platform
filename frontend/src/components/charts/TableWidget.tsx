import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { WidgetData } from '@/types'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Download, ZoomIn, ZoomOut } from 'lucide-react'
import * as XLSX from 'xlsx'

const DENSITY_CONFIG = {
  compact:  { rowHeight: 25, textClass: 'text-xs',  cellPad: 'px-2 py-0.5', headerHeight: 29 },
  default:  { rowHeight: 33, textClass: 'text-sm',  cellPad: 'px-3 py-2',   headerHeight: 37 },
  large:    { rowHeight: 44, textClass: 'text-base', cellPad: 'px-3 py-3',   headerHeight: 46 },
} as const
type Density = keyof typeof DENSITY_CONFIG

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
  const density: Density = (config.tableDensity as string) in DENSITY_CONFIG
    ? (config.tableDensity as Density)
    : 'default'
  const { rowHeight, textClass, cellPad, headerHeight } = DENSITY_CONFIG[density]
  const cols = data.columns || []
  const allRows = data.rows || []

  // Determine visible columns from config
  const visibleCols = Array.isArray(config.visibleColumns)
    ? (config.visibleColumns as string[]).filter(c => cols.includes(c))
    : cols

  // Configurable page size from chartConfig, 0 or undefined = auto
  const configPageSize = Number(config.tablePageSize) || 0

  // Sorting
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedRows = sortCol
    ? [...allRows].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        const an = Number(av), bn = Number(bv)
        const cmp = (!isNaN(an) && !isNaN(bn))
          ? an - bn
          : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? cmp : -cmp
      })
    : allRows

  const handleSort = useCallback((col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(0)
  }, [sortCol])

  // Zoom (50% - 200%)
  const [zoom, setZoom] = useState(100)
  const zoomFactor = zoom / 100
  const effectiveRowHeight = Math.round(rowHeight * zoomFactor)
  const effectiveHeaderHeight = Math.round(headerHeight * zoomFactor)

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
      const available = h - effectiveHeaderHeight - FOOTER_HEIGHT - (title ? 28 : 0)
      const rows = Math.max(5, Math.floor(available / effectiveRowHeight))
      setAutoPageSize(rows)
      setPage(0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [title, configPageSize, userPageSize, effectiveRowHeight, effectiveHeaderHeight])

  const pageSize = userPageSize > 0 ? userPageSize : configPageSize > 0 ? configPageSize : autoPageSize

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safeePage = Math.min(page, totalPages - 1)
  const pageRows = sortedRows.slice(safeePage * pageSize, (safeePage + 1) * pageSize)

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
        <table className={`w-full ${textClass}`} style={{
          transform: `scale(${zoomFactor})`,
          transformOrigin: 'top left',
          width: `${100 / zoomFactor}%`,
        }}>
          <thead className="sticky top-0 bg-surface-100 dark:bg-dark-surface-100">
            <tr>
              {visibleCols.map((col) => {
                const isActive = sortCol === col
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`${cellPad} text-left font-medium whitespace-nowrap cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 ${
                      isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {isActive ? (
                        sortDir === 'asc'
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-dark-surface-100">
            {pageRows.map((row, i) => {
              // Conditional background via chartConfig.rowColorBy + rowColors.
              //   "rowColorBy": "Приоритет",
              //   "rowColors": { "Высокий": "#dcfce7", "Средний": "#fef3c7" },
              //   "rowColorMode": "row" | "cell"   (default: "row")
              // When rowColorMode === "cell", only the cell in the rowColorBy
              // column gets the background; the rest of the row stays neutral.
              const rowColorBy = typeof config.rowColorBy === 'string' ? config.rowColorBy : undefined
              const rowColors = (config.rowColors as Record<string, string> | undefined) || undefined
              const rowColorMode = config.rowColorMode === 'cell' ? 'cell' : 'row'
              const matchedBg = rowColorBy && rowColors
                ? rowColors[String(row[rowColorBy] ?? '')]
                : undefined
              const rowBg = rowColorMode === 'row' ? matchedBg : undefined
              const cellBg = rowColorMode === 'cell' ? matchedBg : undefined
              return (
                <tr
                  key={safeePage * pageSize + i}
                  onClick={onRowClick ? () => onRowClick(row as Record<string, unknown>) : undefined}
                  style={rowBg ? { backgroundColor: rowBg } : undefined}
                  className={`hover:bg-surface-50 dark:hover:bg-dark-surface-50/50 transition-colors ${
                    clickable ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20' : ''
                  }`}
                >
                  {visibleCols.map((col) => (
                    <td
                      key={col}
                      style={cellBg && col === rowColorBy ? { backgroundColor: cellBg } : undefined}
                      className={`${cellPad} whitespace-nowrap text-slate-700 dark:text-slate-300`}
                    >
                      {row[col] != null ? String(row[col]) : <span className="text-slate-400">null</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          {!!config.showTotals && (() => {
            const defaultAgg = (config.totalsAggregation as string) || 'SUM'
            const perCol = (config.totalsPerColumn as Record<string, string>) || {}
            return (
              <tfoot className="sticky bottom-0 bg-surface-100 dark:bg-dark-surface-100 border-t-2 border-surface-300 dark:border-dark-surface-100">
                <tr>
                  {visibleCols.map((col, ci) => {
                    const agg = perCol[col] || defaultAgg
                    if (agg === 'NONE') return <td key={col} className={`${cellPad}`} />
                    const values = allRows.map(r => Number(r[col])).filter(n => !isNaN(n))
                    const isNumeric = values.length > 0 && values.length >= allRows.length * 0.5
                    let result = ''
                    if (isNumeric && values.length > 0) {
                      switch (agg) {
                        case 'SUM': result = values.reduce((a, b) => a + b, 0).toLocaleString(); break
                        case 'COUNT': result = String(allRows.length); break
                        case 'DISTINCT_COUNT': result = String(new Set(allRows.map(r => r[col])).size); break
                        case 'AVG': result = (values.reduce((a, b) => a + b, 0) / values.length).toLocaleString(undefined, { maximumFractionDigits: 2 }); break
                        case 'MIN': result = Math.min(...values).toLocaleString(); break
                        case 'MAX': result = Math.max(...values).toLocaleString(); break
                      }
                    } else if (ci === 0) {
                      result = t('common.total')
                    }
                    return (
                      <td key={col} className={`${cellPad} whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200`}>
                        {result}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )
          })()}
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
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            disabled={zoom <= 50}
            className="p-0.5 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100 disabled:opacity-30 text-slate-500"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span
            className="text-[10px] text-slate-400 min-w-[32px] text-center cursor-pointer"
            onClick={() => setZoom(100)}
            title="Reset zoom"
          >
            {zoom}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            disabled={zoom >= 200}
            className="p-0.5 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100 disabled:opacity-30 text-slate-500"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
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
