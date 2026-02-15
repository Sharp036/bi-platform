import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { reportApi } from '@/api/reports'
import { drillApi } from '@/api/drilldown'
import type { Report, RenderReportResponse, DrillAction, DrillNavigateResponse } from '@/types'
import EnhancedParameterPanel from './EnhancedParameterPanel'
import WidgetRenderer from './WidgetRenderer'
import DrillDownBreadcrumb from './DrillDownBreadcrumb'
import type { BreadcrumbEntry } from './DrillDownBreadcrumb'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { ArrowLeft, RefreshCw, Clock, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import ExportMenu from './ExportMenu'
import BookmarkBar from './BookmarkBar'
import OverlayLayer from '@/components/interactive/OverlayLayer'
import { useActionStore } from '@/store/useActionStore'
import { interactiveApi } from '@/api/interactive'
import type { InteractiveMeta } from '@/types'
import { workspaceApi } from '@/api/workspace'
import FavoriteButton from '@/components/workspace/FavoriteButton'
import { useLiveData } from '@/hooks/useLiveData'
import LiveIndicator from './LiveIndicator'

export default function ReportViewerPage() {
  const { t } = useTranslation()
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
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<number[]>([])
  const [interactiveMeta, setInteractiveMeta] = useState<InteractiveMeta | null>(null)
  const initializedRef = useRef(false)

  const [liveEnabled, setLiveEnabled] = useState(false)
  const { status: liveStatus, lastUpdate: liveLastUpdate, reconnect: liveReconnect } = useLiveData({
    enabled: liveEnabled,
    reportId: currentReportId,
    onReportUpdate: () => handleRender(),
  })

  // Load initial report
  useEffect(() => {
    if (!id) return
    const reportId = Number(id)
    reportApi.get(reportId)
      .then(r => {
        setReport(r)
        workspaceApi.trackView('REPORT', reportId).catch(() => {})
        setCurrentReportId(reportId)
        if (!initializedRef.current) {
          setNavStack([{ reportId, reportName: r.name, parameters: {}, label: r.name }])
          initializedRef.current = true
        }
      })
      .catch(() => toast.error(t('reports.failed_to_load')))
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

  // Render report with explicit params
  const renderWithParams = useCallback(async (paramsToUse: Record<string, unknown>) => {
    const rId = currentReportId || (id ? Number(id) : null)
    if (!rId) return
    setRendering(true)
    try {
      const result = await reportApi.render(rId, paramsToUse)
      setRenderResult(result)
      await loadDrillActions(rId)
      // Load interactive meta
      const widgetIds = result.widgets.map((w: any) => w.widgetId)
      interactiveApi.getMeta(rId, widgetIds).then(meta => {
        setInteractiveMeta(meta)
        useActionStore.getState().setActions(meta.actions)
      }).catch(() => {})
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('reports.failed_to_render'))
    }
    finally { setRendering(false) }
  }, [currentReportId, id, loadDrillActions, t])

  // Render report (merge into current params)
  const handleRender = useCallback(async (params?: Record<string, unknown>) => {
    const mergedParams = { ...currentParams, ...params }
    setCurrentParams(mergedParams)
    await renderWithParams(mergedParams)
  }, [currentParams, renderWithParams])

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

      toast.success(t('reports.drill_down_to', { name: navResult.targetReportName }))
    } catch {
      toast.error(t('reports.drill_failed'))
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
      toast.error(t('reports.failed_to_navigate'))
    }
  }, [navStack])

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
    await renderWithParams(nextParams)
  }, [currentParams, renderWithParams])

  // ── Render ──

  if (loading) return <LoadingSpinner />
  if (!report) return <div className="text-center py-12 text-slate-500">{t('reports.report_not_found')}</div>

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
          <FavoriteButton objectType="REPORT" objectId={Number(id)} size={20} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <LiveIndicator
              status={liveStatus}
              lastUpdate={liveLastUpdate}
              enabled={liveEnabled}
              onToggle={setLiveEnabled}
              onReconnect={liveReconnect}
            />
            <Clock className="w-4 h-4 text-slate-400" />
            <select
              value={autoRefresh || ''}
              onChange={e => setAutoRefresh(e.target.value ? Number(e.target.value) : null)}
              className="input text-xs w-24 py-1"
            >
              <option value="">{t('common.off')}</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
              <option value="300">5m</option>
            </select>
          </div>
          <button onClick={() => handleRender()} disabled={rendering} className="btn-secondary text-sm">
            <RefreshCw className={`w-4 h-4 ${rendering ? 'animate-spin' : ''}`} /> {t('common.refresh')}
          </button>
          <button
            onClick={() => { reportApi.createSnapshot(Number(id)); toast.success(t('reports.snapshot_created')) }}
            className="btn-secondary text-sm"
          >
            <Camera className="w-4 h-4" /> {t('reports.snapshot')}
          </button>
          <ExportMenu reportId={Number(id)} reportName={report.name} />
        </div>
      </div>

      {/* Breadcrumb */}
      <DrillDownBreadcrumb stack={navStack} onNavigate={handleBreadcrumbNavigate} />

      {/* Parameters */}
      <EnhancedParameterPanel reportId={Number(id)} parameters={report.parameters} onApply={handleRender} loading={rendering} />

      {/* Bookmarks */}
      <BookmarkBar
        reportId={currentReportId || Number(id)}
        currentParameters={currentParams}
        onApplyBookmark={(params) => {
          setCurrentParams(params)
          handleRender(params)
        }}
      />

      {/* Execution stats */}
      {renderResult && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          {t('reports.rendered_stats', { count: renderResult.widgets.length, ms: renderResult.executionMs })}
        </p>
      )}

      {/* Widgets grid */}
      {rendering && !renderResult ? (
        <LoadingSpinner />
      ) : renderResult ? (
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: '70px' }}>
          {renderResult.widgets
            .filter(w => !hiddenWidgetIds.includes(w.widgetId))
            .map((w) => {
            const pos = parsePosition(w.position)
            const x = Math.max(0, Number(pos.x) || 0)
            const y = Math.max(0, Number(pos.y) || 0)
            const wSpan = Math.min(12, Math.max(1, Number(pos.w) || 12))
            const hSpan = Math.max(1, Number(pos.h) || 4)
            const widgetDrillActions = drillActions[w.widgetId] || []
            const hasDrill = widgetDrillActions.length > 0
            return (
              <div
                key={w.widgetId}
                className={`card p-4 overflow-hidden ${hasDrill ? 'ring-1 ring-brand-200 dark:ring-brand-800' : ''}`}
                style={{
                  gridColumn: `${x + 1} / span ${wSpan}`,
                  gridRow: `${y + 1} / span ${hSpan}`,
                }}
              >
                {hasDrill && (
                  <div className="text-[10px] text-brand-500 dark:text-brand-400 mb-1 flex items-center gap-1">
                    <span>⤵</span>
                    <span>{t('reports.drill_to', { name: widgetDrillActions[0].targetReportName })}</span>
                  </div>
                )}
                <WidgetRenderer
                  widget={w}
                  drillActions={widgetDrillActions}
                  onDrillDown={hasDrill ? (data) => handleDrillDown(w.widgetId, data) : undefined}
                  layers={interactiveMeta?.chartLayers?.[w.widgetId] || []}
                  reportId={currentReportId || Number(id)}
                  onToggleWidgets={handleToggleWidgets}
                  onApplyFilter={handleApplyFilter}
                  onChartClick={(data) => {
                    useActionStore.getState().triggerAction(w.widgetId, 'CLICK', data)
                  }}
                />
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Floating overlays (logos, images) */}
      {interactiveMeta?.overlays && interactiveMeta.overlays.length > 0 && (
        <div className="relative">
          <OverlayLayer overlays={interactiveMeta.overlays} />
        </div>
      )}
    </div>
  )
}
