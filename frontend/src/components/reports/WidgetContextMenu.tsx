import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreVertical, Code, Table, X, Copy, Check } from 'lucide-react'
import type { WidgetData } from '@/types'

interface Props {
  rawSql?: string
  data?: WidgetData
  title?: string
}

export default function WidgetContextMenu({ rawSql, data, title }: Props) {
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

      {modal === 'query' && rawSql && (
        <QueryModal sql={rawSql} title={title} onClose={() => setModal(null)} />
      )}
      {modal === 'table' && data && (
        <TableModal data={data} title={title} onClose={() => setModal(null)} />
      )}
    </>
  )
}

function QueryModal({ sql, title, onClose }: { sql: string; title?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [sql])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-dark-surface-100">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">
            {t('widget_menu.view_query')}{title ? ` - ${title}` : ''}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t('widget_menu.copied') : t('common.copy')}
            </button>
            <button onClick={onClose} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-1 p-5">
          <pre className="text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
            {sql}
          </pre>
        </div>
      </div>
    </div>
  )
}

function TableModal({ data, title, onClose }: { data: WidgetData; title?: string; onClose: () => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

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
                    className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-surface-200 dark:border-dark-surface-100 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-surface-100 dark:border-dark-surface-100 hover:bg-surface-50 dark:hover:bg-dark-surface-100/50"
                >
                  {data.columns.map(col => (
                    <td
                      key={col}
                      className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[300px] truncate"
                      title={row[col] != null ? String(row[col]) : ''}
                    >
                      {row[col] != null ? String(row[col]) : ''}
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
