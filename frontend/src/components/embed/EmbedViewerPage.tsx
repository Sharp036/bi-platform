import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { RenderReportResponse } from '@/types'
import WidgetRenderer from '@/components/reports/WidgetRenderer'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import axios from 'axios'

/**
 * Public embed viewer — renders a report via embed token.
 * No authentication required. Route: /embed/:token
 */
export default function EmbedViewerPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const [renderResult, setRenderResult] = useState<RenderReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentParams, setCurrentParams] = useState<Record<string, string>>({})
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<number[]>([])

  const fetchRender = useCallback(async (params: Record<string, string>) => {
    if (!token) return
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
    try {
      const r = await axios.get(`${baseUrl}/embed/${token}`, { params })
      setRenderResult(r.data)
      setError(null)
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.statusText || t('embed.error')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    if (!token) return
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => { params[key] = value })
    setCurrentParams(params)
    fetchRender(params)
  }, [token, searchParams, fetchRender])

  const handleToggleWidgets = useCallback((widgetIds: number[]) => {
    if (!widgetIds || widgetIds.length === 0) return
    setHiddenWidgetIds(prev => {
      const next = new Set(prev)
      widgetIds.forEach((wid) => {
        if (next.has(wid)) next.delete(wid)
        else next.add(wid)
      })
      return Array.from(next)
    })
  }, [])

  const handleApplyFilter = useCallback(async (field: string, value: string) => {
    if (!field) return
    const nextParams = { ...currentParams }
    if (value == null || value === '') {
      delete nextParams[field]
    } else {
      nextParams[field] = value
    }
    setCurrentParams(nextParams)
    setLoading(true)
    await fetchRender(nextParams)
  }, [currentParams, fetchRender])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-2">{t('embed.error')}</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!renderResult) return null

  const parsePosition = (pos?: string) => {
    if (!pos) return { x: 0, y: 0, w: 12, h: 4 }
    try { return JSON.parse(pos) } catch { return { x: 0, y: 0, w: 12, h: 4 } }
  }

  return (
    <div className="p-4 bg-white dark:bg-slate-900 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: '70px' }}>
          {renderResult.widgets
            .filter(w => !hiddenWidgetIds.includes(w.widgetId))
            .map(w => {
            const pos = parsePosition(w.position)
            const x = Math.max(0, Number(pos.x) || 0)
            const y = Math.max(0, Number(pos.y) || 0)
            const wSpan = Math.min(12, Math.max(1, Number(pos.w) || 12))
            const hSpan = Math.max(1, Number(pos.h) || 4)
            return (
              <div
                key={w.widgetId}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
                style={{
                  gridColumn: `${x + 1} / span ${wSpan}`,
                  gridRow: `${y + 1} / span ${hSpan}`,
                }}
              >
                <WidgetRenderer
                  widget={w}
                  onToggleWidgets={handleToggleWidgets}
                  onApplyFilter={handleApplyFilter}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
