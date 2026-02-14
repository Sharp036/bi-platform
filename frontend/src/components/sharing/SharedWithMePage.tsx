import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { sharingApi, SharedObjectItem } from '@/api/sharing'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Share2, FileBarChart, Database, LayoutDashboard, Search } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const typeIcon: Record<string, typeof FileBarChart> = {
  REPORT: FileBarChart,
  DATASOURCE: Database,
  DASHBOARD: LayoutDashboard,
}

const typePath: Record<string, string> = {
  REPORT: '/reports',
  DATASOURCE: '/datasources',
  DASHBOARD: '/',
}

const accessColor: Record<string, string> = {
  VIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  EDIT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function SharedWithMePage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<SharedObjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    sharingApi.sharedWithMe()
      .then(setItems)
      .catch(() => toast.error(t('common.failed_to_load')))
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter(item => {
    if (filterType && item.objectType !== filterType) return false
    if (search && !item.objectName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('sharing.title')}</h1>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search')} className="input pl-9"
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input w-40">
          <option value="">{t('sharing.all_types')}</option>
          <option value="REPORT">{t('sharing.type.reports')}</option>
          <option value="DATASOURCE">{t('sharing.type.datasources')}</option>
          <option value="DASHBOARD">{t('sharing.type.dashboards')}</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState
          icon={<Share2 className="w-12 h-12" />}
          title={t('sharing.empty')}
          description={t('sharing.empty_desc')}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const Icon = typeIcon[item.objectType] || FileBarChart
            const path = item.objectType === 'REPORT'
              ? `/reports/${item.objectId}`
              : typePath[item.objectType] || '/'

            return (
              <Link
                key={`${item.objectType}-${item.objectId}`}
                to={path}
                className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                    {item.objectName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.objectType} {item.sharedBy && `· ${t('sharing.shared_by', { name: item.sharedBy })}`}
                  </p>
                </div>

                <span className={clsx(
                  'text-xs font-medium px-2 py-1 rounded',
                  accessColor[item.accessLevel] || accessColor.VIEW
                )}>
                  {item.accessLevel}
                </span>

                <span className="text-xs text-slate-400">
                  {new Date(item.sharedAt).toLocaleDateString()}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
