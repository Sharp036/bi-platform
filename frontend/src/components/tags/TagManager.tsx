import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { tagApi, TagDto, ObjectTagDto } from '@/api/tagsearch'
import { Plus, X, Tag } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

interface TagManagerProps {
  objectType: string
  objectId: number
  compact?: boolean
}

export default function TagManager({ objectType, objectId, compact = false }: TagManagerProps) {
  const { t } = useTranslation()
  const [tags, setTags] = useState<ObjectTagDto[]>([])
  const [allTags, setAllTags] = useState<TagDto[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tagApi.getObjectTags(objectType, objectId).then(setTags).catch(() => {})
  }, [objectType, objectId])

  const openPicker = async () => {
    try {
      const all = await tagApi.list()
      setAllTags(all)
      setShowPicker(true)
    } catch {
      toast.error(t('tags.failed_load'))
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const assignTag = async (tagId: number) => {
    try {
      const assigned = await tagApi.assign(tagId, objectType, objectId)
      setTags(prev => {
        if (prev.some(t => t.tagId === assigned.tagId)) return prev
        return [...prev, assigned]
      })
    } catch {
      toast.error(t('tags.failed_assign'))
    }
  }

  const removeTag = async (tagId: number) => {
    try {
      await tagApi.removeTag(objectType, objectId, tagId)
      setTags(prev => prev.filter(t => t.tagId !== tagId))
    } catch {
      toast.error(t('tags.failed_remove'))
    }
  }

  const createAndAssign = async () => {
    if (!newTagName.trim()) return
    try {
      const tag = await tagApi.create(newTagName.trim())
      await assignTag(tag.id)
      setNewTagName('')
      setAllTags(prev => [...prev, tag])
    } catch {
      toast.error(t('tags.failed_create'))
    }
  }

  const availableTags = allTags.filter(t => !tags.some(ot => ot.tagId === t.id))

  return (
    <div className="relative inline-flex items-center gap-1 flex-wrap">
      {tags.map(t => (
        <span
          key={t.tagId}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full font-medium',
            compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
          )}
          style={{
            backgroundColor: t.tagColor ? `${t.tagColor}20` : '#f1f5f9',
            color: t.tagColor || '#64748b'
          }}
        >
          {t.tagName}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); removeTag(t.tagId) }}
            className="hover:opacity-70"
          >
            <X style={{ width: compact ? 10 : 12, height: compact ? 10 : 12 }} />
          </button>
        </span>
      ))}

      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); openPicker() }}
        className={clsx(
          'inline-flex items-center gap-0.5 rounded-full border border-dashed transition-colors',
          'border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-500',
          'dark:border-slate-600 dark:text-slate-500 dark:hover:border-brand-400 dark:hover:text-brand-400',
          compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
        )}
      >
        <Plus style={{ width: compact ? 10 : 12, height: compact ? 10 : 12 }} />
        {!compact && t('tags.tag_label')}
      </button>

      {showPicker && (
        <div ref={pickerRef}
          className="absolute top-full left-0 mt-1 w-56 card shadow-xl z-50 p-2"
          onClick={e => e.stopPropagation()}>
          <div className="flex gap-1 mb-2">
            <input
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createAndAssign()}
              placeholder={t('tags.new_placeholder')}
              className="input text-xs flex-1 py-1"
              autoFocus
            />
            {newTagName.trim() && (
              <button onClick={createAndAssign} className="btn-primary text-xs px-2 py-1">
                {t('common.add')}
              </button>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {availableTags.length === 0 ? (
              <p className="text-xs text-slate-400 py-1 px-1">
                {allTags.length === 0 ? t('tags.no_tags') : t('tags.all_assigned')}
              </p>
            ) : availableTags.map(t => (
              <button
                key={t.id}
                onClick={() => assignTag(t.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-surface-50 dark:hover:bg-dark-surface-100"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.color || '#94a3b8' }}
                />
                <span className="text-xs text-slate-700 dark:text-slate-200">{t.name}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{t.usageCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
