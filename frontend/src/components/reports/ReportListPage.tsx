import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reportApi } from '@/api/reports'
import type { Report } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { FileBarChart, Plus, Eye, Copy, Archive, Search, Pencil, Share2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import ShareDialog from '@/components/sharing/ShareDialog'

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    ARCHIVED: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }
  return map[status] || map.DRAFT
}

export default function ReportListPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [shareReport, setShareReport] = useState<Report | null>(null)

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { size: 50 }
    if (filterStatus) params.status = filterStatus
    reportApi.list(params as { status?: string; page?: number; size?: number }).then((data) => {
      setReports(data.content || [])
    }).catch(() => toast.error('Failed to load reports')).finally(() => setLoading(false))
  }

  useEffect(load, [filterStatus])

  const filtered = search
    ? reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : reports

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reports</h1>
        <Link to="/reports/new" className="btn-primary"><Plus className="w-4 h-4" /> New Report</Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reports..." className="input pl-9"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-40">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState
          icon={<FileBarChart className="w-12 h-12" />}
          title="No reports yet"
          description="Create your first report to visualize data"
          action={<Link to="/reports/new" className="btn-primary"><Plus className="w-4 h-4" /> Create Report</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.id} className="card p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <Link to={`/reports/${r.id}`} className="text-base font-semibold text-slate-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 truncate block">
                    {r.name}
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{r.description || 'No description'}</p>
                </div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0', statusBadge(r.status))}>
                  {r.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-3">
                <span>{r.widgets?.length || 0} widgets</span>
                <span>·</span>
                <span>{r.parameters?.length || 0} params</span>
                <span>·</span>
                <span>{new Date(r.updatedAt).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link to={`/reports/${r.id}/edit`} className="btn-ghost p-1.5 text-xs"><Pencil className="w-3.5 h-3.5" /></Link>
                <Link to={`/reports/${r.id}`} className="btn-ghost p-1.5 text-xs"><Eye className="w-3.5 h-3.5" /></Link>
                <button onClick={() => { reportApi.duplicate(r.id); toast.success('Duplicated'); load() }} className="btn-ghost p-1.5 text-xs"><Copy className="w-3.5 h-3.5" /></button>
                <button onClick={() => { reportApi.archive(r.id); toast.success('Archived'); load() }} className="btn-ghost p-1.5 text-xs"><Archive className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => { e.preventDefault(); setShareReport(r) }} className="btn-ghost p-1.5 text-xs"><Share2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {shareReport && (
        <ShareDialog
          objectType="REPORT"
          objectId={shareReport.id}
          objectName={shareReport.name}
          onClose={() => setShareReport(null)}
        />
      )}
    </div>
  )
}
