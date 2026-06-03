import { useState } from 'react'
import { FolderInput } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { workspaceApi, FolderDto } from '@/api/workspace'
import toast from 'react-hot-toast'

interface Props {
  objectType: string
  objectId: number
  className?: string
  size?: number
  // Called after a successful move so the caller can refresh folder contents.
  onMoved?: (folderId: number) => void
}

// Folder picker for moving a report (or any workspace object) into a folder.
// Backend exposes POST /workspace/folders/{id}/items; this is the only UI entry
// point. Self-contained: fetches the folder list when opened.
export default function MoveToFolderMenu({ objectType, objectId, className, size = 14, onMoved }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [folders, setFolders] = useState<FolderDto[]>([])
  const [loading, setLoading] = useState(false)

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    try {
      setFolders(await workspaceApi.getFolderTree())
    } catch {
      toast.error(t('common.failed_to_load'))
    } finally {
      setLoading(false)
    }
  }

  const move = async (e: React.MouseEvent, folderId: number) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await workspaceApi.addToFolder(folderId, objectType, objectId)
      toast.success(t('workspace.moved_to_folder'))
      setOpen(false)
      onMoved?.(folderId)
    } catch {
      toast.error(t('workspace.failed_move_to_folder'))
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        title={t('workspace.move_to_folder')}
        className={className || 'btn-ghost p-1.5 text-xs'}
      >
        <FolderInput style={{ width: size, height: size }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false) }} />
          <div className="absolute right-0 top-full z-20 mt-1 w-52 max-h-64 overflow-auto rounded-lg border border-surface-200 dark:border-dark-surface-100 bg-white dark:bg-dark-surface-50 shadow-lg py-1">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">{t('workspace.move_to_folder')}</p>
            {loading ? (
              <p className="px-3 py-2 text-xs text-slate-400">...</p>
            ) : folders.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">{t('workspace.no_folders')}</p>
            ) : folders.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={e => move(e, f.id)}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-dark-surface-100 truncate"
              >
                {f.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
