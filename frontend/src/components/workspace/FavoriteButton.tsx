import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { workspaceApi } from '@/api/workspace'
import { Star } from 'lucide-react'
import clsx from 'clsx'

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
    workspaceApi.isFavorite(objectType, objectId)
      .then(r => setIsFav(r.isFavorite))
      .catch(() => {})
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
