import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { RenderReportResponse } from '@/types'
import WidgetRenderer from '@/components/reports/WidgetRenderer'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import axios from 'axios'

/**
 * Public embed viewer — renders a report via embed token.
 * No authentication required. Route: /embed/:token
 */
export default function EmbedViewerPage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const [renderResult, setRenderResult] = useState<RenderReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    // Build extra params from URL query string
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => { params[key] = value })

    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

    axios.get(`${baseUrl}/embed/${token}`, { params })
      .then(r => setRenderResult(r.data))
      .catch(err => {
        const msg = err.response?.data?.message || err.response?.statusText || 'Failed to load report'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token, searchParams])

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
          <p className="text-red-500 text-lg mb-2">Unable to load report</p>
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
        <div className="grid grid-cols-12 gap-4">
          {renderResult.widgets.map(w => {
            const pos = parsePosition(w.position)
            const colSpan = pos.w || 12
            const minH = pos.h ? pos.h * 70 : 280
            return (
              <div
                key={w.widgetId}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
                style={{
                  gridColumn: `span ${Math.min(colSpan, 12)}`,
                  minHeight: `${minH}px`,
                }}
              >
                <WidgetRenderer widget={w} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
