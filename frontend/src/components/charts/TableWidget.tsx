import type { WidgetData } from '@/types'

interface Props { data: WidgetData; title?: string }

export default function TableWidget({ data, title }: Props) {
  const cols = data.columns || []
  const rows = data.rows || []

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {title && <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">{title}</h3>}
      <div className="flex-1 overflow-auto rounded-lg border border-surface-200 dark:border-dark-surface-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-100 dark:bg-dark-surface-100">
            <tr>
              {cols.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-dark-surface-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-surface-50 dark:hover:bg-dark-surface-50/50 transition-colors">
                {cols.map((col) => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {row[col] != null ? String(row[col]) : <span className="text-slate-400">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-400">No data</div>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-right px-1">
        {data.rowCount} row{data.rowCount !== 1 ? 's' : ''} · {data.executionMs}ms
      </div>
    </div>
  )
}
