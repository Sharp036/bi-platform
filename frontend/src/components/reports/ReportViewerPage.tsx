import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { reportApi } from '@/api/reports'
import { drillApi } from '@/api/drilldown'
import type { Report, RenderReportResponse, DrillAction, DrillNavigateResponse } from '@/types'
import ParameterPanel from './ParameterPanel'
import WidgetRenderer from './WidgetRenderer'
import DrillDownBreadcrumb from './DrillDownBreadcrumb'
import type { BreadcrumbEntry } from './DrillDownBreadcrumb'
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

  // Drill-down state
  const [drillActions, setDrillActions] = useState<Record<number, DrillAction[]>>({})
  const [navStack, setNavStack] = useState<BreadcrumbEntry[]>([])
  const [currentReportId, setCurrentReportId] = useState<number | null>(null)
  const [currentParams, setCurrentParams] = useState<Record<string, unknown>>({})
  const initializedRef = useRef(false)

  // Load initial report
  useEffect(() => {
    if (!id) return
    const reportId = Number(id)
    reportApi.get(reportId)
      .then(r => {
        setReport(r)
        setCurrentReportId(reportId)
        if (!initializedRef.current) {
          setNavStack([{ reportId, reportName: r.name, parameters: {}, label: r.name }])
          initializedRef.current = true
        }
      })
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false))
  }, [id])

  // Load drill actions when report changes
  const loadDrillActions = useCallback(async (reportId: number) => {
    try {
      const actions = await drillApi.forReport(reportId)
      setDrillActions(actions)
    } catch {
      // No drill actions — that's fine
      setDrillActions({})
    }
  }, [])

  // Render report
  const handleRender = useCallback(async (params?: Record<string, unknown>) => {
    const rId = currentReportId || (id ? Number(id) : null)
    if (!rId) return
    setRendering(true)
    try {
      const mergedParams = { ...currentParams, ...params }
      const result = await reportApi.render(rId, mergedParams)
      setRenderResult(result)
      await loadDrillActions(rId)
    } catch { toast.error('Failed to render report') }
    finally { setRendering(false) }
  }, [currentReportId, id, currentParams, loadDrillActions])

  // Initial render
  useEffect(() => {
    if (report && currentReportId) handleRender()
  }, [report, currentReportId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useAutoRefresh(() => handleRender(), autoRefresh)

  // ── Drill-down navigation ──

  const handleDrillDown = useCallback(async (
    widgetId: number,
    clickedData: Record<string, unknown>
  ) => {
    const actions = drillActions[widgetId]
    if (!actions || actions.length === 0) return

    // Use first matching action (could extend to show menu for multiple)
    const action = actions[0]

    try {
      const navResult: DrillNavigateResponse = await drillApi.navigate({
        actionId: action.id,
        clickedData,
        currentParameters: currentParams
      })

      if (navResult.openMode === 'NEW_TAB') {
        const paramStr = new URLSearchParams(
          Object.entries(navResult.resolvedParameters)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
        window.open(`/reports/${navResult.targetReportId}${paramStr ? '?' + paramStr : ''}`, '_blank')
        return
      }

      // REPLACE mode: push to stack, load new report
      const newEntry: BreadcrumbEntry = {
        reportId: navResult.targetReportId,
        reportName: navResult.targetReportName,
        parameters: navResult.resolvedParameters,
        label: navResult.breadcrumbLabel
      }

      setNavStack(prev => [...prev, newEntry])
      setCurrentReportId(navResult.targetReportId)
      setCurrentParams(navResult.resolvedParameters)

      // Load new report metadata
      const newReport = await reportApi.get(navResult.targetReportId)
      setReport(newReport)

      toast.success(`Drill down → ${navResult.targetReportName}`)
    } catch {
      toast.error('Drill-down navigation failed')
    }
  }, [drillActions, currentParams])

  // Breadcrumb navigation (go back to previous level)
  const handleBreadcrumbNavigate = useCallback(async (index: number) => {
    const entry = navStack[index]
    if (!entry) return

    // Truncate stack to this level
    setNavStack(prev => prev.slice(0, index + 1))
    setCurrentReportId(entry.reportId)
    setCurrentParams(entry.parameters)

    try {
      const newReport = await reportApi.get(entry.reportId)
      setReport(newReport)
    } catch {
      toast.error('Failed to navigate back')
    }
  }, [navStack])

  // ── Render ──

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

      {/* Breadcrumb */}
      <DrillDownBreadcrumb stack={navStack} onNavigate={handleBreadcrumbNavigate} />

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
            const widgetDrillActions = drillActions[w.widgetId] || []
            const hasDrill = widgetDrillActions.length > 0
            return (
              <div
                key={w.widgetId}
                className={`card p-4 ${hasDrill ? 'ring-1 ring-brand-200 dark:ring-brand-800' : ''}`}
                style={{
                  gridColumn: `span ${Math.min(colSpan, 12)}`,
                  minHeight: `${minH}px`,
                }}
              >
                {hasDrill && (
                  <div className="text-[10px] text-brand-500 dark:text-brand-400 mb-1 flex items-center gap-1">
                    <span>⤵</span>
                    <span>Click to drill → {widgetDrillActions[0].targetReportName}</span>
                  </div>
                )}
                <WidgetRenderer
                  widget={w}
                  drillActions={widgetDrillActions}
                  onDrillDown={hasDrill ? (data) => handleDrillDown(w.widgetId, data) : undefined}
                />
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
