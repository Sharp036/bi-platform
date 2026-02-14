import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { workspaceApi, WorkspaceOverview, FolderDto, FolderItemDto } from '@/api/workspace'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  Star, Clock, FolderOpen, FileBarChart, Database, LayoutDashboard,
  Plus, ChevronRight, Trash2, Edit3, MoreHorizontal
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const typeIcon: Record<string, typeof FileBarChart> = {
  REPORT: FileBarChart,
  DATASOURCE: Database,
  DASHBOARD: LayoutDashboard,
}

const typeLink = (objectType: string, objectId: number) => {
  switch (objectType) {
    case 'REPORT': return `/reports/${objectId}`
    case 'DATASOURCE': return `/datasources`
    default: return '/'
  }
}

export default function WorkspacePage() {
  const { t } = useTranslation()
  const [data, setData] = useState<WorkspaceOverview | null>(null)
  const [loading, setLoading] = useState(true)

  // Folder state
  const [openFolder, setOpenFolder] = useState<number | null>(null)
  const [folderItems, setFolderItems] = useState<FolderItemDto[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)

  const load = () => {
    setLoading(true)
    workspaceApi.overview()
      .then(setData)
      .catch(() => toast.error(t('common.failed_to_load')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const loadFolder = async (folderId: number) => {
    setOpenFolder(folderId)
    try {
      const items = await workspaceApi.getFolderContents(folderId)
      setFolderItems(items)
    } catch {
      toast.error(t('common.failed_to_load'))
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await workspaceApi.createFolder({ name: newFolderName.trim() })
      setNewFolderName('')
      setShowNewFolder(false)
      load()
      toast.success(t('workspace.folder_created'))
    } catch {
      toast.error(t('workspace.failed_create_folder'))
    }
  }

  const deleteFolder = async (id: number) => {
    if (!confirm(t('workspace.delete_folder_confirm'))) return
    try {
      await workspaceApi.deleteFolder(id)
      if (openFolder === id) { setOpenFolder(null); setFolderItems([]) }
      load()
      toast.success(t('workspace.folder_deleted'))
    } catch {
      toast.error(t('common.failed_to_delete'))
    }
  }

  if (loading) return <LoadingSpinner />
  if (!data) return null

  return (
    <div className="max-w-[1200px] mx-auto space-y-8">

      {/* Favorites */}
      {data.favorites.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-white mb-4">
            <Star className="w-5 h-5 text-amber-400" fill="currentColor" /> {t('workspace.favorites')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.favorites.map(fav => {
              const Icon = typeIcon[fav.objectType] || FileBarChart
              return (
                <Link
                  key={`${fav.objectType}-${fav.objectId}`}
                  to={typeLink(fav.objectType, fav.objectId)}
                  className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{fav.objectName}</p>
                    <p className="text-xs text-slate-400">{fav.objectType}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent Items */}
      {data.recentItems.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-white mb-4">
            <Clock className="w-5 h-5 text-slate-400" /> {t('workspace.recent')}
          </h2>
          <div className="space-y-1">
            {data.recentItems.map(item => {
              const Icon = typeIcon[item.objectType] || FileBarChart
              return (
                <Link
                  key={`${item.objectType}-${item.objectId}`}
                  to={typeLink(item.objectType, item.objectId)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-dark-surface-100 transition-colors"
                >
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{item.objectName}</span>
                  {item.isFavorite && <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />}
                  <span className="text-xs text-slate-400">{new Date(item.viewedAt).toLocaleDateString()}</span>
                  <span className="text-xs text-slate-300 dark:text-slate-600">{item.viewCount}×</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Folders */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-white">
            <FolderOpen className="w-5 h-5 text-brand-500" /> {t('workspace.folders')}
          </h2>
          <button onClick={() => setShowNewFolder(true)} className="btn-secondary text-sm">
            <Plus className="w-4 h-4" /> {t('workspace.new_folder')}
          </button>
        </div>

        {showNewFolder && (
          <div className="flex items-center gap-2 mb-4">
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              placeholder={t('workspace.folder_name_placeholder')}
              className="input flex-1 max-w-xs"
              autoFocus
            />
            <button onClick={createFolder} className="btn-primary text-sm" disabled={!newFolderName.trim()}>{t('common.create')}</button>
            <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="btn-secondary text-sm">{t('common.cancel')}</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.folders.length === 0 && !showNewFolder ? (
            <p className="text-sm text-slate-400 col-span-full">{t('workspace.no_folders')}</p>
          ) : data.folders.map(folder => (
            <div
              key={folder.id}
              className={clsx(
                'card p-3 cursor-pointer hover:shadow-md transition-shadow group',
                openFolder === folder.id && 'ring-2 ring-brand-500'
              )}
              onClick={() => loadFolder(folder.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="w-5 h-5 flex-shrink-0"
                    style={{ color: folder.color || undefined }} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {folder.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id) }}
                    className="p-1 rounded text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">{folder.itemCount} items</p>
            </div>
          ))}
        </div>

        {/* Folder contents */}
        {openFolder && (
          <div className="mt-4 card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {t('workspace.folder_contents')}
              </h3>
              <button onClick={() => { setOpenFolder(null); setFolderItems([]) }}
                className="text-xs text-slate-400 hover:text-slate-600">{t('common.close')}</button>
            </div>
            {folderItems.length === 0 ? (
              <p className="text-sm text-slate-400">{t('workspace.empty_folder')}</p>
            ) : (
              <div className="space-y-1">
                {folderItems.map(item => {
                  const Icon = typeIcon[item.objectType] || FileBarChart
                  return (
                    <Link
                      key={item.id}
                      to={typeLink(item.objectType, item.objectId)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-dark-surface-100"
                    >
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{item.objectName}</span>
                      <span className="text-xs text-slate-400">{item.objectType}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
