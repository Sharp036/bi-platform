import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { workspaceApi } from '@/api/workspace'
import { Star } from 'lucide-react'
import clsx from 'clsx'

// Batch pending checks: group multiple FavoriteButton mounts into one API call
const pendingChecks: Map<string, { ids: Set<number>; callbacks: Map<number, (isFav: boolean) => void> }> = new Map()
let batchTimer: ReturnType<typeof setTimeout> | null = null

function scheduleBatchCheck(objectType: string, objectId: number, callback: (isFav: boolean) => void) {
  const key = objectType
  if (!pendingChecks.has(key)) pendingChecks.set(key, { ids: new Set(), callbacks: new Map() })
  const batch = pendingChecks.get(key)!
  batch.ids.add(objectId)
  batch.callbacks.set(objectId, callback)

  if (batchTimer) clearTimeout(batchTimer)
  batchTimer = setTimeout(() => {
    for (const [type, { ids, callbacks }] of pendingChecks.entries()) {
      const idArr = [...ids]
      workspaceApi.isFavoriteBatch(type, idArr)
        .then(result => {
          for (const [id, cb] of callbacks) cb(!!result[id])
        })
        .catch(() => {
          for (const [, cb] of callbacks) cb(false)
        })
    }
    pendingChecks.clear()
    batchTimer = null
  }, 50) // 50ms debounce -- all buttons mount within one render cycle
}

interface FavoriteButtonProps {
  objectType: string
  objectId: number
  className?: string
  size?: number
}

export default function FavoriteButton({ objectType, objectId, className, size = 16 }: FavoriteButtonProps) {
  const { t } = useTranslation()
  const [isFav, setIsFav] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    scheduleBatchCheck(objectType, objectId, setIsFav)
  }, [objectType, objectId])

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const result = await workspaceApi.toggleFavorite(objectType, objectId)
      setIsFav(result.isFavorite)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  return (
    <button
      onClick={toggle}
      className={clsx(
        'p-1 rounded transition-colors',
        isFav
          ? 'text-amber-400 hover:text-amber-500'
          : 'text-slate-300 hover:text-amber-400 dark:text-slate-600 dark:hover:text-amber-400',
        className
      )}
      title={isFav ? t('workspace.remove_favorite') : t('workspace.add_favorite')}
    >
      <Star
        className={clsx('transition-all', loading && 'animate-pulse')}
        style={{ width: size, height: size }}
        fill={isFav ? 'currentColor' : 'none'}
      />
    </button>
  )
}
