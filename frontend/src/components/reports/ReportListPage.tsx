import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { reportApi } from '@/api/reports'
import type { ReportListItem } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { FileBarChart, Plus, Eye, Copy, Archive, Search, Pencil, Share2, Trash2, LayoutGrid, List, Folder, FolderOpen, FolderPlus, ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import ShareDialog from '@/components/sharing/ShareDialog'
import FavoriteButton from '@/components/workspace/FavoriteButton'
import MoveToFolderMenu from '@/components/workspace/MoveToFolderMenu'
import TagManager from '@/components/tags/TagManager'
import { useAuthStore } from '@/store/authStore'
import { workspaceApi, FolderDto } from '@/api/workspace'

// Synthetic folder id for the "no folder" group (real folder ids are positive).
const UNCATEGORIZED = -1
const COLLAPSED_KEY = 'reports_collapsed_folders'

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    ARCHIVED: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }
  return map[status] || map.DRAFT
}

// Depth-first flatten of the folder tree (every folder at any nesting level).
function flattenFolders(tree: FolderDto[]): FolderDto[] {
  const out: FolderDto[] = []
  const walk = (f: FolderDto) => { out.push(f); (f.children || []).forEach(walk) }
  tree.forEach(walk)
  return out
}

export default function ReportListPage() {
  const { t } = useTranslation()
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [folders, setFolders] = useState<FolderDto[]>([])
  // folderId -> set of reportIds it contains (from dl_folder_item, so it matches
  // the move-to-folder actions). A report may be in several folders.
  const [folderReportIds, setFolderReportIds] = useState<Record<number, Set<number>>>({})
  // Folders are expanded by default; we persist only the COLLAPSED ones, so a
  // fresh visit shows everything (the empty set means all-expanded).
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]')) } catch { return new Set() }
  })
  const [shareReport, setShareReport] = useState<ReportListItem | null>(null)
  // Drag-and-drop move: the dragged report and the folder it was dragged FROM
  // (null = the "no folder" group). Dropping on another folder moves it there.
  const [dragReportId, setDragReportId] = useState<number | null>(null)
  const [dragSrcFolder, setDragSrcFolder] = useState<number | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<number | null>(null)
  // Inline folder creation: { parentId } where null means a root folder.
  const [newFolder, setNewFolder] = useState<{ parentId: number | null } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
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

  const toggleFolder = (id: number) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })
  // While searching every group is forced open so matches are never hidden.
  const isExpanded = (id: number) => !!search || !collapsed.has(id)
  const expandFolder = (id: number) => setCollapsed(prev => {
    if (!prev.has(id)) return prev
    const next = new Set(prev); next.delete(id)
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })

  // ── Drag-and-drop move between folders ──
  const startDrag = (reportId: number, srcFolder: number | null) => {
    setDragReportId(reportId)
    setDragSrcFolder(srcFolder)
  }
  const endDrag = () => { setDragReportId(null); setDragSrcFolder(null); setDragOverFolder(null) }
  const handleDrop = async (target: number) => {
    const rid = dragReportId
    const src = dragSrcFolder
    endDrag()
    if (rid == null) return
    try {
      if (target === UNCATEGORIZED) {
        if (src == null) return // already outside any folder
        await workspaceApi.removeFromFolder(src, 'REPORT', rid)
        toast.success(t('reports.removed_from_folder'))
      } else {
        if (src === target) return // dropped on its own folder
        await workspaceApi.addToFolder(target, 'REPORT', rid)
        if (src != null) await workspaceApi.removeFromFolder(src, 'REPORT', rid)
        toast.success(t('reports.moved_to_folder'))
      }
      loadFolders()
    } catch {
      toast.error(t('common.error'))
    }
  }

  // ── Inline folder creation ──
  const folderNameById = (id: number) => flattenFolders(folders).find(f => f.id === id)?.name ?? ''
  const submitNewFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    try {
      await workspaceApi.createFolder({ name, parentId: newFolder?.parentId ?? undefined })
      toast.success(t('reports.folder_created'))
      setNewFolder(null)
      setNewFolderName('')
      loadFolders()
    } catch {
      toast.error(t('common.error'))
    }
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

  // Build folderId -> reportIds for every folder in the tree (all depths).
  const loadFolders = async () => {
    try {
      const tree = await workspaceApi.getFolderTree()
      setFolders(tree)
      const all = flattenFolders(tree)
      const contents = await Promise.all(all.map(f =>
        workspaceApi.getFolderContents(f.id).then(items => ({ folder: f, items })).catch(() => ({ folder: f, items: [] }))
      ))
      const byFolder: Record<number, Set<number>> = {}
      for (const { folder, items } of contents) {
        const ids = new Set<number>()
        for (const it of items) {
          if (it.objectType !== 'REPORT') continue
          ids.add(it.objectId)
        }
        byFolder[folder.id] = ids
      }
      setFolderReportIds(byFolder)
    } catch {
      // folder data is optional - the list still works without it
    }
  }

  useEffect(() => { loadFolders() }, [])

  const filtered = reports.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  )

  // A report belongs to a folder if any folder set contains it.
  const reportsOfFolder = (fid: number) => filtered.filter(r => folderReportIds[fid]?.has(r.id))
  const inAnyFolder = (id: number) => Object.values(folderReportIds).some(set => set.has(id))
  const uncategorized = filtered.filter(r => !inAnyFolder(r.id))
  // A folder is worth showing if it (or any descendant) holds a matching report.
  // Without a search every folder is shown so empty folders stay visible.
  const folderHasMatches = (folder: FolderDto): boolean =>
    reportsOfFolder(folder.id).length > 0 || (folder.children || []).some(folderHasMatches)
  const showFolder = (folder: FolderDto) => !search || folderHasMatches(folder)

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
      <MoveToFolderMenu objectType="REPORT" objectId={r.id} onMoved={() => loadFolders()} />
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

  // ── Folder header row (shared by both view modes). Doubles as a drop target;
  // real folders also offer an "add subfolder" action on hover. ──
  const folderHeader = (id: number, name: string, count: number, depth: number, canAddSub: boolean) => {
    const open = isExpanded(id)
    const over = dragOverFolder === id
    return (
      <div
        role="button"
        onClick={() => toggleFolder(id)}
        onDragOver={e => { if (dragReportId != null) { e.preventDefault(); setDragOverFolder(id) } }}
        onDragLeave={() => setDragOverFolder(prev => (prev === id ? null : prev))}
        onDrop={e => { e.preventDefault(); handleDrop(id) }}
        style={{ paddingLeft: 12 + depth * 18 }}
        className={clsx(
          'group w-full flex items-center gap-2 py-2 pr-3 text-left cursor-pointer border-b border-surface-100 dark:border-dark-surface-100',
          over
            ? 'bg-brand-50 dark:bg-brand-900/20 ring-2 ring-inset ring-brand-400'
            : 'hover:bg-surface-50 dark:hover:bg-dark-surface-50',
        )}
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        {open
          ? <FolderOpen className="w-4 h-4 text-brand-500 flex-shrink-0" />
          : <Folder className="w-4 h-4 text-brand-500 flex-shrink-0" />}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{name}</span>
        <span className="text-xs text-slate-400">({count})</span>
        {canAddSub && canCreate && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); expandFolder(id); setNewFolder({ parentId: id }); setNewFolderName('') }}
            className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-surface-100 dark:hover:bg-dark-surface-200 transition"
            title={t('reports.add_subfolder')}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  // ── Table-mode report row (flat row, indented under its folder, draggable) ──
  const reportRow = (r: ReportListItem, depth: number, srcFolder: number | null) => (
    <div
      key={`${depth}-${r.id}`}
      draggable
      onDragStart={() => startDrag(r.id, srcFolder)}
      onDragEnd={endDrag}
      className={clsx(
        'grid grid-cols-[1fr_7rem_5rem_5rem_6rem_auto] items-center gap-2 pr-3 py-2 border-b border-surface-100 dark:border-dark-surface-100 hover:bg-surface-50 dark:hover:bg-dark-surface-50 group',
        dragReportId === r.id && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex items-center gap-2" style={{ paddingLeft: 12 + depth * 18 }}>
        <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-grab" />
        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono flex-shrink-0">#{r.id}</span>
        <div className="min-w-0">
          <Link to={`/reports/${r.slug}`} className="font-medium text-slate-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 truncate block">
            {r.name}
          </Link>
          {r.description && <p className="text-xs text-slate-400 truncate">{r.description}</p>}
        </div>
      </div>
      <div>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', statusBadge(r.status))}>
          {statusLabel(r.status)}
        </span>
      </div>
      <div className="text-right text-slate-500 dark:text-slate-400 text-sm">{r.widgetCount ?? 0}</div>
      <div className="text-right text-slate-500 dark:text-slate-400 text-sm">{r.parameterCount ?? 0}</div>
      <div className="text-slate-500 dark:text-slate-400 text-xs">{new Date(r.updatedAt).toLocaleDateString()}</div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">{rowActions(r)}</div>
    </div>
  )

  // ── Grid-mode report card (draggable) ──
  const reportCard = (r: ReportListItem, srcFolder: number | null) => (
    <div
      key={r.id}
      draggable
      onDragStart={() => startDrag(r.id, srcFolder)}
      onDragEnd={endDrag}
      className={clsx('card p-4 hover:shadow-md transition-shadow group cursor-grab', dragReportId === r.id && 'opacity-50')}
    >
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
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">{rowActions(r)}</div>
    </div>
  )

  // ── Recursive folder renderers (one per view mode) ──
  const renderFolderRows = (folder: FolderDto, depth: number) => {
    if (!showFolder(folder)) return null
    return (
      <Fragment key={`f-${folder.id}`}>
        {folderHeader(folder.id, folder.name, reportsOfFolder(folder.id).length, depth, true)}
        {isExpanded(folder.id) && (
          <>
            {(folder.children || []).map(c => renderFolderRows(c, depth + 1))}
            {reportsOfFolder(folder.id).map(r => reportRow(r, depth + 1, folder.id))}
          </>
        )}
      </Fragment>
    )
  }

  const renderFolderCards = (folder: FolderDto, depth: number) => {
    if (!showFolder(folder)) return null
    const reps = reportsOfFolder(folder.id)
    return (
      <div key={`f-${folder.id}`}>
        {folderHeader(folder.id, folder.name, reps.length, depth, true)}
        {isExpanded(folder.id) && (
          <div style={{ paddingLeft: depth * 18 }} className="py-3 space-y-3">
            {(folder.children || []).map(c => renderFolderCards(c, depth + 1))}
            {reps.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {reps.map(r => reportCard(r, folder.id))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('reports.title')}</h1>
        <div className="flex items-center gap-2">
          {canCreate && (
            <button onClick={() => { setNewFolder({ parentId: null }); setNewFolderName('') }} className="btn-secondary">
              <FolderPlus className="w-4 h-4" /> {t('reports.new_folder')}
            </button>
          )}
          {canCreate && <Link to="/reports/new" className="btn-primary"><Plus className="w-4 h-4" /> {t('reports.new_report')}</Link>}
        </div>
      </div>

      {/* Inline folder creation bar */}
      {newFolder && (
        <div className="flex items-center gap-2 mb-4 p-2 card">
          <Folder className="w-4 h-4 text-brand-500 flex-shrink-0" />
          {newFolder.parentId != null && (
            <span className="text-xs text-slate-400 whitespace-nowrap">{t('reports.in_folder')}: {folderNameById(newFolder.parentId)}</span>
          )}
          <input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNewFolder(); if (e.key === 'Escape') { setNewFolder(null); setNewFolderName('') } }}
            placeholder={t('reports.folder_name_placeholder')}
            className="input flex-1 max-w-xs"
          />
          <button onClick={submitNewFolder} disabled={!newFolderName.trim()} className="btn-primary disabled:opacity-50">{t('common.create')}</button>
          <button onClick={() => { setNewFolder(null); setNewFolderName('') }} className="btn-ghost">{t('common.cancel')}</button>
        </div>
      )}

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
          {/* Column header */}
          <div className="grid grid-cols-[1fr_7rem_5rem_5rem_6rem_auto] items-center gap-2 pr-3 py-2 bg-surface-50 dark:bg-dark-surface-50 border-b border-surface-200 dark:border-dark-surface-200 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="pl-3">{t('common.name')}</span>
            <span>{t('common.status')}</span>
            <span className="text-right">{t('reports.col_widgets')}</span>
            <span className="text-right">{t('reports.col_params')}</span>
            <span>{t('common.updated')}</span>
            <span className="w-44" />
          </div>
          {folders.map(f => renderFolderRows(f, 0))}
          {uncategorized.length > 0 && (
            <>
              {folderHeader(UNCATEGORIZED, t('reports.no_folder'), uncategorized.length, 0, false)}
              {isExpanded(UNCATEGORIZED) && uncategorized.map(r => reportRow(r, 1, null))}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map(f => renderFolderCards(f, 0))}
          {uncategorized.length > 0 && (
            <div>
              {folderHeader(UNCATEGORIZED, t('reports.no_folder'), uncategorized.length, 0, false)}
              {isExpanded(UNCATEGORIZED) && (
                <div className="py-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {uncategorized.map(r => reportCard(r, null))}
                </div>
              )}
            </div>
          )}
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
