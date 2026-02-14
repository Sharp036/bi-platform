import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookmarkApi } from '@/api/advanced'
import type { BookmarkItem } from '@/types'
import { Bookmark, Plus, Trash2, Star, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  reportId: number
  currentParameters: Record<string, unknown>
  onApplyBookmark: (params: Record<string, unknown>) => void
}

export default function BookmarkBar({ reportId, currentParameters, onApplyBookmark }: Props) {
  const { t } = useTranslation()
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [showSave, setShowSave] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveShared, setSaveShared] = useState(false)

  const load = () => {
    bookmarkApi.listForReport(reportId).then(setBookmarks).catch(() => {})
  }

  useEffect(load, [reportId])

  const handleSave = async () => {
    if (!saveName.trim()) { toast.error(t('bookmarks.enter_name')); return }
    try {
      await bookmarkApi.create({
        reportId,
        name: saveName,
        parameters: currentParameters,
        isShared: saveShared,
      })
      toast.success(t('bookmarks.saved'))
      setShowSave(false)
      setSaveName('')
      load()
    } catch { toast.error(t('bookmarks.failed_save')) }
  }

  const handleDelete = async (id: number) => {
    try {
      await bookmarkApi.delete(id)
      toast.success(t('common.deleted'))
      load()
    } catch { toast.error(t('bookmarks.failed_delete')) }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await bookmarkApi.update(id, { isDefault: true })
      toast.success(t('bookmarks.set_default'))
      load()
    } catch { toast.error(t('bookmarks.failed_update')) }
  }

  return (
    <div className="flex items-center gap-2 mb-3 overflow-x-auto">
      <Bookmark className="w-4 h-4 text-slate-400 flex-shrink-0" />

      {bookmarks.map(bm => (
        <div key={bm.id} className="flex items-center gap-1 group flex-shrink-0">
          <button
            onClick={() => onApplyBookmark(bm.parameters)}
            className="text-xs px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-dark-surface-100 text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors flex items-center gap-1"
          >
            {bm.isDefault && <Star className="w-3 h-3 text-amber-500" />}
            {bm.name}
            {bm.isShared && <span className="text-[9px] text-slate-400">{t('bookmarks.shared')}</span>}
          </button>
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button onClick={() => handleSetDefault(bm.id)} className="p-0.5 text-slate-400 hover:text-amber-500" title="Set default">
              <Star className="w-3 h-3" />
            </button>
            <button onClick={() => handleDelete(bm.id)} className="p-0.5 text-slate-400 hover:text-red-500" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => setShowSave(true)}
        className="text-xs px-2 py-1 rounded-lg border border-dashed border-surface-300 dark:border-dark-surface-100 text-slate-400 hover:text-brand-500 hover:border-brand-300 transition-colors flex items-center gap-1 flex-shrink-0"
      >
        <Plus className="w-3 h-3" /> {t('common.save')}
      </button>

      {/* Save dialog */}
      {showSave && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSave(false)}>
          <div className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-white">{t('bookmarks.save')}</h3>
              <button onClick={() => setShowSave(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={saveName} onChange={e => setSaveName(e.target.value)}
              className="input text-sm mb-3" placeholder={t('bookmarks.bookmark_name')}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
              <input type="checkbox" checked={saveShared} onChange={e => setSaveShared(e.target.checked)} />
              {t('bookmarks.share_all')}
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSave(false)} className="btn-secondary text-sm">{t('common.cancel')}</button>
              <button onClick={handleSave} className="btn-primary text-sm">
                <Bookmark className="w-4 h-4" /> {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
