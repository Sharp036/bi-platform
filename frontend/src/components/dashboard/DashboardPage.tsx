import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { reportApi } from '@/api/reports'
import { datasourceApi } from '@/api/datasources'
import { queryApi } from '@/api/queries'
import type { ReportListItem, DataSource } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { FileBarChart, Database, Code2, TrendingUp, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { t } = useTranslation()
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [queryCount, setQueryCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      reportApi.list({ size: 5 }).then(d => setReports(d.content || [])).catch(() => {}),
      datasourceApi.list().then(d => setDatasources(d || [])).catch(() => {}),
      queryApi.list({ size: 1 }).then(d => setQueryCount(d.totalElements || 0)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const stats = [
    { icon: FileBarChart, label: t('nav.reports'), value: reports.length, color: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30' },
    { icon: Database, label: t('nav.datasources'), value: datasources.length, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
    { icon: Code2, label: t('dashboard.saved_queries'), value: queryCount, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' },
    { icon: TrendingUp, label: t('common.status.published'), value: reports.filter(r => r.status === 'PUBLISHED').length, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
  ]

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t('dashboard.title')}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent reports */}
        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-dark-surface-100">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">{t('dashboard.recent_reports')}</h2>
            <Link to="/reports" className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              {t('dashboard.view_all')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-surface-200 dark:divide-dark-surface-100">
            {reports.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">{t('reports.no_reports')}</p>
            ) : reports.map(r => (
              <Link key={r.id} to={`/reports/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-50 dark:hover:bg-dark-surface-50/50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{r.name}</p>
                  <p className="text-xs text-slate-400">{t('reports.widgets_count', { count: r.widgetCount ?? 0 })} · {new Date(r.updatedAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>{r.status}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Data Sources */}
        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-dark-surface-100">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">{t('nav.datasources')}</h2>
            <Link to="/datasources" className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              {t('dashboard.manage')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-surface-200 dark:divide-dark-surface-100">
            {datasources.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">{t('dashboard.no_datasources')}</p>
            ) : datasources.map(ds => (
              <div key={ds.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Database className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{ds.name}</p>
                    <p className="text-xs text-slate-400">{ds.type} · {ds.host}:{ds.port}</p>
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full ${ds.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
