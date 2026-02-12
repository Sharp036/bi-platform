import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { reportApi } from '@/api/reports'
import type { Report, RenderReportResponse } from '@/types'
import ParameterPanel from './ParameterPanel'
import WidgetRenderer from './WidgetRenderer'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { ArrowLeft, RefreshCw, Clock, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReportViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<Report | null>(null)
  const [renderResult, setRenderResult] = useState<RenderReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    reportApi.get(Number(id)).then(setReport).catch(() => toast.error('Failed to load report')).finally(() => setLoading(false))
  }, [id])

  const handleRender = useCallback(async (params?: Record<string, unknown>) => {
    if (!id) return
    setRendering(true)
    try {
      const result = await reportApi.render(Number(id), params)
      setRenderResult(result)
    } catch { toast.error('Failed to render report') }
    finally { setRendering(false) }
  }, [id])

  // Initial render on load
  useEffect(() => {
    if (report) handleRender()
  }, [report, handleRender])

  // Auto-refresh
  useAutoRefresh(() => handleRender(), autoRefresh)

  if (loading) return <LoadingSpinner />
  if (!report) return <div className="text-center py-12 text-slate-500">Report not found</div>

  const parsePosition = (pos?: string) => {
    if (!pos) return { x: 0, y: 0, w: 12, h: 4 }
    try { return JSON.parse(pos) } catch { return { x: 0, y: 0, w: 12, h: 4 } }
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{report.name}</h1>
            {report.description && <p className="text-sm text-slate-500 dark:text-slate-400">{report.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh selector */}
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <select
              value={autoRefresh || ''}
              onChange={e => setAutoRefresh(e.target.value ? Number(e.target.value) : null)}
              className="input text-xs w-24 py-1"
            >
              <option value="">Off</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
              <option value="300">5m</option>
            </select>
          </div>

          <button onClick={() => handleRender()} disabled={rendering} className="btn-secondary text-sm">
            <RefreshCw className={`w-4 h-4 ${rendering ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => { reportApi.createSnapshot(Number(id)); toast.success('Snapshot created') }}
            className="btn-secondary text-sm"
          >
            <Camera className="w-4 h-4" /> Snapshot
          </button>
        </div>
      </div>

      {/* Parameters */}
      <ParameterPanel parameters={report.parameters} onApply={handleRender} loading={rendering} />

      {/* Execution stats */}
      {renderResult && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          Rendered {renderResult.widgets.length} widget{renderResult.widgets.length !== 1 ? 's' : ''} in {renderResult.executionMs}ms
        </p>
      )}

      {/* Widgets grid */}
      {rendering && !renderResult ? (
        <LoadingSpinner />
      ) : renderResult ? (
        <div className="grid grid-cols-12 gap-4">
          {renderResult.widgets.map((w) => {
            const pos = parsePosition(w.position)
            const colSpan = pos.w || 12
            const minH = pos.h ? pos.h * 70 : 280
            return (
              <div
                key={w.widgetId}
                className="card p-4"
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
      ) : null}
    </div>
  )
}
