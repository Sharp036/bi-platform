import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { reportApi } from '@/api/reports'
import type { ReportListItem } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { FileBarChart, Plus, Eye, Copy, Archive, Search, Pencil, Share2, Trash2, LayoutGrid, List } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import ShareDialog from '@/components/sharing/ShareDialog'
import FavoriteButton from '@/components/workspace/FavoriteButton'
import TagManager from '@/components/tags/TagManager'
import { useAuthStore } from '@/store/authStore'

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    ARCHIVED: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }
  return map[status] || map.DRAFT
}

export default function ReportListPage() {
  const { t } = useTranslation()
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [shareReport, setShareReport] = useState<ReportListItem | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() =>
    (localStorage.getItem('reports_view_mode') as 'grid' | 'table') ?? 'grid'
  )
  const permissions = useAuthStore(s => s.user?.permissions ?? [])
  const canCreate = permissions.includes('REPORT_CREATE')
  const canEdit = permissions.includes('REPORT_EDIT')
  const canDelete = permissions.includes('REPORT_DELETE')
  const canShare = permissions.includes('REPORT_SHARE')

  const setView = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('reports_view_mode', mode)
  }

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { size: 50 }
    if (filterStatus) params.status = filterStatus
    reportApi.list(params as { status?: string; page?: number; size?: number }).then((data) => {
      setReports(data.content || [])
    }).catch(() => toast.error(t('reports.failed_to_load'))).finally(() => setLoading(false))
  }

  useEffect(load, [filterStatus])

  const filtered = search
    ? reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : reports

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: t('common.status.draft'),
      PUBLISHED: t('common.status.published'),
      ARCHIVED: t('common.status.archived'),
    }
    return labels[status] || status
  }

  const rowActions = (r: ReportListItem) => (
    <div className="flex items-center gap-1">
      <FavoriteButton objectType="REPORT" objectId={r.id} size={14} />
      {canEdit && (
        <Link to={`/reports/${r.slug}/edit`} className="btn-ghost p-1.5 text-xs" title={t('common.edit')}><Pencil className="w-3.5 h-3.5" /></Link>
      )}
      <Link to={`/reports/${r.slug}`} className="btn-ghost p-1.5 text-xs" title={t('common.view')}><Eye className="w-3.5 h-3.5" /></Link>
      {canEdit && (<>
        <button onClick={async () => {
          const suffix = t('reports.copy_suffix', 'copy')
          const existingNames = new Set(reports.map(x => x.name))
          let copyName = `${r.name} (${suffix})`
          let idx = 2
          while (existingNames.has(copyName)) {
            copyName = `${r.name} (${suffix} ${idx})`
            idx++
          }
          await reportApi.duplicate(r.id, copyName)
          toast.success(t('reports.duplicated'))
          load()
        }} className="btn-ghost p-1.5 text-xs" title={t('common.duplicate')}><Copy className="w-3.5 h-3.5" /></button>
        <button onClick={async () => { await reportApi.archive(r.id); toast.success(t('reports.archived')); load() }} className="btn-ghost p-1.5 text-xs" title={t('common.archive')}><Archive className="w-3.5 h-3.5" /></button>
      </>)}
      {canShare && (
        <button onClick={(e) => { e.preventDefault(); setShareReport(r) }} className="btn-ghost p-1.5 text-xs" title={t('common.share')}><Share2 className="w-3.5 h-3.5" /></button>
      )}
      {canDelete && (
        <button
          onClick={async () => {
            if (!window.confirm(t('common.confirm_delete'))) return
            try {
              await reportApi.delete(r.id)
              toast.success(t('common.deleted'))
              setReports(prev => prev.filter(x => x.id !== r.id))
            } catch {
              toast.error(t('common.error'))
            }
          }}
          className="btn-ghost p-1.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400"
          title={t('common.delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('reports.title')}</h1>
        {canCreate && <Link to="/reports/new" className="btn-primary"><Plus className="w-4 h-4" /> {t('reports.new_report')}</Link>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('reports.search_placeholder')} className="input pl-9"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-40">
          <option value="">{t('reports.all_statuses')}</option>
          <option value="DRAFT">{t('common.status.draft')}</option>
          <option value="PUBLISHED">{t('common.status.published')}</option>
          <option value="ARCHIVED">{t('common.status.archived')}</option>
        </select>
        <div className="flex items-center rounded-lg border border-surface-200 dark:border-dark-surface-200 overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={clsx('p-2 transition-colors', viewMode === 'grid'
              ? 'bg-brand-600 text-white'
              : 'bg-white dark:bg-dark-surface-100 text-slate-500 hover:bg-surface-100 dark:hover:bg-dark-surface-200')}
            title={t('reports.view_grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('table')}
            className={clsx('p-2 transition-colors', viewMode === 'table'
              ? 'bg-brand-600 text-white'
              : 'bg-white dark:bg-dark-surface-100 text-slate-500 hover:bg-surface-100 dark:hover:bg-dark-surface-200')}
            title={t('reports.view_table')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState
          icon={<FileBarChart className="w-12 h-12" />}
          title={t('reports.no_reports')}
          description={t('reports.create_first')}
          action={<Link to="/reports/new" className="btn-primary"><Plus className="w-4 h-4" /> {t('reports.create_report')}</Link>}
        />
      ) : viewMode === 'table' ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-dark-surface-200 bg-surface-50 dark:bg-dark-surface-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 w-16">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{t('common.name')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 w-32">{t('common.status')}</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400 w-24">{t('reports.col_widgets')}</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400 w-24">{t('reports.col_params')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 w-32">{t('common.updated')}</th>
                <th className="px-4 py-3 w-48"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-surface-100 dark:border-dark-surface-100 hover:bg-surface-50 dark:hover:bg-dark-surface-50 group">
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 font-mono text-xs">#{r.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/reports/${r.slug}`} className="font-medium text-slate-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400">
                      {r.name}
                    </Link>
                    {r.description && <p className="text-xs text-slate-400 truncate max-w-xs">{r.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', statusBadge(r.status))}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{r.widgetCount ?? 0}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{r.parameterCount ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{new Date(r.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {rowActions(r)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(r => (
            <div key={r.id} className="card p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono flex-shrink-0">#{r.id}</span>
                    <Link to={`/reports/${r.slug}`} className="text-base font-semibold text-slate-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 truncate block">
                      {r.name}
                    </Link>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{r.description || t('reports.no_description')}</p>
                </div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0', statusBadge(r.status))}>
                  {statusLabel(r.status)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-3">
                <span>{t('reports.widgets_count', { count: r.widgetCount ?? 0 })}</span>
                <span>·</span>
                <span>{t('reports.params_count', { count: r.parameterCount ?? 0 })}</span>
                <span>·</span>
                <span>{new Date(r.updatedAt).toLocaleDateString()}</span>
              </div>

              <div className="mb-2">
                <TagManager objectType="REPORT" objectId={r.id} compact />
              </div>

              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                {rowActions(r)}
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
