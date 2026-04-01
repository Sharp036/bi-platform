import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
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
import { ArrowLeft, RefreshCw, Clock, Camera, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ExportMenu from './ExportMenu'
import WidgetContextMenu from './WidgetContextMenu'
import BookmarkBar from './BookmarkBar'
import OverlayLayer from '@/components/interactive/OverlayLayer'
import { useActionStore, type DrillReplaceEntry } from '@/store/useActionStore'
import { interactiveApi } from '@/api/interactive'
import type { InteractiveMeta } from '@/types'
import { workspaceApi } from '@/api/workspace'
import FavoriteButton from '@/components/workspace/FavoriteButton'
import { useLiveData } from '@/hooks/useLiveData'
import LiveIndicator from './LiveIndicator'
import { vizApi } from '@/api/visualization'
import type { ContainerItem } from '@/api/visualization'
import TabContainer from '@/components/interactive/TabContainer'

type FilterPanelPosition = 'top' | 'bottom' | 'left' | 'right'

function getFilterPanelLayout(layout?: string): { position: FilterPanelPosition; collapsed: boolean } {
  if (!layout) return { position: 'top', collapsed: false }
  try {
    const parsed = JSON.parse(layout) as {
      filterPanel?: { position?: FilterPanelPosition; collapsed?: boolean }
    }
    const position = parsed.filterPanel?.position
    return {
      position: position === 'top' || position === 'bottom' || position === 'left' || position === 'right'
        ? position
        : 'top',
      collapsed: !!parsed.filterPanel?.collapsed,
    }
  } catch {
    return { position: 'top', collapsed: false }
  }
}

export default function ReportViewerPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<Report | null>(null)
  const [renderResult, setRenderResult] = useState<RenderReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState<number | null>(null)

  const [drillActions, setDrillActions] = useState<Record<number, DrillAction[]>>({})
  const [navStack, setNavStack] = useState<BreadcrumbEntry[]>([])
  const [currentReportId, setCurrentReportId] = useState<number | null>(null)
  const [currentParams, setCurrentParams] = useState<Record<string, unknown>>({})
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<number[]>([])
  const [interactiveMeta, setInteractiveMeta] = useState<InteractiveMeta | null>(null)
  const initializedRef = useRef(false)

  const [filterPanelPosition, setFilterPanelPosition] = useState<FilterPanelPosition>('top')
  const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false)
  const [filterPanelWidth, setFilterPanelWidth] = useState(320) // w-80 = 320px

  const [containers, setContainers] = useState<ContainerItem[]>([])
  const [activeTabByContainer, setActiveTabByContainer] = useState<Record<number, number>>({})

  const [liveEnabled, setLiveEnabled] = useState(false)
  const { status: liveStatus, lastUpdate: liveLastUpdate, reconnect: liveReconnect } = useLiveData({
    enabled: liveEnabled,
    reportId: currentReportId,
    onReportUpdate: () => handleRender(),
  })

  useEffect(() => {
    if (!id) return
    reportApi.get(id).then(r => {
      const numericId = r.id
      return vizApi.getContainers(numericId).catch(() => [] as ContainerItem[]).then(c => ({ r, c, numericId }))
    }).then(({ r, c, numericId }) => {
        setReport(r)
        setContainers(c)
        setActiveTabByContainer(Object.fromEntries(c.map(ct => [ct.id, ct.activeTab || 0])))
        const filterPanelLayout = getFilterPanelLayout(r.layout)
        setFilterPanelPosition(filterPanelLayout.position)
        setFilterPanelCollapsed(filterPanelLayout.collapsed)
        workspaceApi.trackView('REPORT', numericId).catch(() => {})
        setCurrentReportId(numericId)
        if (!initializedRef.current) {
          setNavStack([{ reportId: numericId, reportName: r.name, parameters: {}, label: r.name }])
          initializedRef.current = true
        }
      })
      .catch(() => toast.error(t('reports.failed_to_load')))
      .finally(() => setLoading(false))
  }, [id, t])

  const loadDrillActions = useCallback(async (reportId: number) => {
    try {
      const actions = await drillApi.forReport(reportId)
      setDrillActions(actions)
    } catch {
      setDrillActions({})
    }
  }, [])

  const renderWithParams = useCallback(async (paramsToUse: Record<string, unknown>) => {
    const rId = currentReportId || (id ? report?.id || 0 : null)
    if (!rId) return
    setRendering(true)
    try {
      const result = await reportApi.render(rId, paramsToUse)
      setRenderResult(result)
      await loadDrillActions(rId)
      const widgetIds = result.widgets.map((w: any) => w.widgetId)
      interactiveApi.getMeta(rId, widgetIds).then(meta => {
        setInteractiveMeta(meta)
        useActionStore.getState().setActions(meta.actions)
      }).catch(() => {})
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('reports.failed_to_render'))
    } finally {
      setRendering(false)
    }
  }, [currentReportId, id, loadDrillActions, t])

  const handleRender = useCallback(async (params?: Record<string, unknown>) => {
    // Replace params entirely (not merge) so cleared filters don't persist
    const finalParams = params ?? currentParams
    setCurrentParams(finalParams)
    await renderWithParams(finalParams)
  }, [currentParams, renderWithParams])

  useEffect(() => {
    if (report && currentReportId) handleRender()
  }, [report, currentReportId]) // eslint-disable-line react-hooks/exhaustive-deps

  useAutoRefresh(() => handleRender(), autoRefresh)

  const handleDrillDown = useCallback(async (
    widgetId: number,
    clickedData: Record<string, unknown>
  ) => {
    const actions = drillActions[widgetId]
    if (!actions || actions.length === 0) return
    const action = actions[0]

    try {
      const navResult: DrillNavigateResponse = await drillApi.navigate({
        actionId: action.id,
        clickedData,
        currentParameters: currentParams,
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

      const newEntry: BreadcrumbEntry = {
        reportId: navResult.targetReportId,
        reportName: navResult.targetReportName,
        parameters: navResult.resolvedParameters,
        label: navResult.breadcrumbLabel,
      }

      setNavStack(prev => [...prev, newEntry])
      setCurrentReportId(navResult.targetReportId)
      setCurrentParams(navResult.resolvedParameters)

      const newReport = await reportApi.get(navResult.targetReportId)
      setReport(newReport)
      const filterPanelLayout = getFilterPanelLayout(newReport.layout)
      setFilterPanelPosition(filterPanelLayout.position)
      setFilterPanelCollapsed(filterPanelLayout.collapsed)

      toast.success(t('reports.drill_down_to', { name: navResult.targetReportName }))
    } catch {
      toast.error(t('reports.drill_failed'))
    }
  }, [drillActions, currentParams, t])

  const handleBreadcrumbNavigate = useCallback(async (index: number) => {
    const entry = navStack[index]
    if (!entry) return

    setNavStack(prev => prev.slice(0, index + 1))
    setCurrentReportId(entry.reportId)
    setCurrentParams(entry.parameters)

    try {
      const newReport = await reportApi.get(entry.reportId)
      setReport(newReport)
      const filterPanelLayout = getFilterPanelLayout(newReport.layout)
      setFilterPanelPosition(filterPanelLayout.position)
      setFilterPanelCollapsed(filterPanelLayout.collapsed)
    } catch {
      toast.error(t('reports.failed_to_navigate'))
    }
  }, [navStack, t])

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
    if (value == null || value === '') delete nextParams[field]
    else nextParams[field] = value
    setCurrentParams(nextParams)
    await renderWithParams(nextParams)
  }, [currentParams, renderWithParams])

  // ── Drill-replace visibility ─────────────────────────────────────────────────
  const drillReplaceStack = useActionStore(s => s.drillReplaceStack)
  const allActions = useActionStore(s => s.actions)
  const drillHiddenSources = useMemo(() => new Set(drillReplaceStack.map(e => e.sourceWidgetId)), [drillReplaceStack])
  const drillVisibleTargets = useMemo(() => new Set(drillReplaceStack.flatMap(e => e.targetWidgetIds)), [drillReplaceStack])

  // Target widgets of DRILL_REPLACE actions are hidden by default until activated
  const drillReplaceTargets = useMemo(() => {
    const ids = new Set<number>()
    for (const a of allActions) {
      if (a.actionType === 'DRILL_REPLACE' && a.isActive && a.targetWidgetIds) {
        a.targetWidgetIds.split(',').forEach(id => { const n = Number(id.trim()); if (n) ids.add(n) })
      }
    }
    return ids
  }, [allActions])

  const isWidgetHidden = useCallback((widgetId: number) => {
    if (drillHiddenSources.has(widgetId)) return true
    if (drillVisibleTargets.has(widgetId)) return false
    if (drillReplaceTargets.has(widgetId)) return true
    return hiddenWidgetIds.includes(widgetId)
  }, [hiddenWidgetIds, drillHiddenSources, drillVisibleTargets, drillReplaceTargets])

  const getDrillEntryForTarget = useCallback((widgetId: number): DrillReplaceEntry | undefined => {
    return drillReplaceStack.find(e => e.targetWidgetIds.includes(widgetId))
  }, [drillReplaceStack])

  // ── Client-side cross-filter for drill-replace targets ─────────────────────
  const activeFilters = useActionStore(s => s.activeFilters)

  const applyClientFilters = useCallback((w: RenderReportResponse['widgets'][number]): RenderReportResponse['widgets'][number] => {
    const filters = activeFilters[w.widgetId]
    const drillEntry = drillReplaceStack.find(e => e.targetWidgetIds.includes(w.widgetId))
    if ((!filters || filters.length === 0) && !drillEntry?.seriesName) return w
    if (!w.data) return w
    let rows = w.data.rows
    if (filters && filters.length > 0) {
      rows = rows.filter(row =>
        filters.every(f => {
          const cellVal = row[f.field]
          if (cellVal == null || f.value == null) return false
          return String(cellVal) === String(f.value)
        })
      )
    }
    // If a specific series was clicked, filter by that metric column > 0
    if (drillEntry?.seriesName && drillEntry.seriesName in (w.data.rows[0] || {})) {
      rows = rows.filter(row => Number(row[drillEntry.seriesName!]) > 0)
    }
    return { ...w, data: { ...w.data, rows, rowCount: rows.length } }
  }, [activeFilters, drillReplaceStack])

  // ── Visible widget IDs (used to filter parameter panel) ──────────────────────
  const visibleWidgetIds = useMemo(() => {
    const ids = new Set<number>()
    const inContainers = new Set(containers.flatMap(c => c.childWidgetIds.flat()))
    for (const c of containers) {
      if (c.containerType === 'TABS') {
        const activeIdx = activeTabByContainer[c.id] ?? (c.activeTab || 0)
        ;(c.childWidgetIds[activeIdx] || []).forEach(id => ids.add(id))
      } else {
        c.childWidgetIds.flat().forEach(id => ids.add(id))
      }
    }
    // Free widgets not in any container and not hidden
    if (report) {
      for (const w of report.widgets) {
        const wid = w.id ?? w.widgetId
        if (wid !== undefined && !inContainers.has(wid) && !isWidgetHidden(wid))
          ids.add(wid)
      }
    }
    return ids
  }, [containers, activeTabByContainer, isWidgetHidden, report])

  // Collect report-param names referenced by visible non-filter widgets
  const usedParamNames = useMemo(() => {
    if (!report) return null
    const names = new Set<string>()
    let anyMapping = false
    for (const w of report.widgets) {
      if (w.widgetType === 'FILTER') continue
      const wid = w.id ?? w.widgetId
      if (wid === undefined || !visibleWidgetIds.has(wid)) continue
      try {
        const mapping = JSON.parse(w.paramMapping || '{}') as Record<string, string>
        const vals = Object.values(mapping)
        if (vals.length > 0) {
          anyMapping = true
          vals.forEach(v => names.add(v))
        }
        // keys are query-param names -- also used by the parameter panel
        Object.keys(mapping).forEach(k => names.add(k))
      } catch { /* ignore */ }
    }
    // null = no widget has paramMapping, so show everything
    return anyMapping ? names : null
  }, [report, visibleWidgetIds])

  // Parameters actually used by currently visible widgets
  const visibleParameters = useMemo(() => {
    if (!report) return []
    if (!usedParamNames) return report.parameters
    return report.parameters.filter(p => usedParamNames.has(p.name))
  }, [report, usedParamNames])

  // IDs of free FILTER widgets whose filterColumn is not used on the current tab
  const autoHiddenFilterIds = useMemo(() => {
    if (!report || !usedParamNames) return new Set<number>()
    const inContainers = new Set(containers.flatMap(c => c.childWidgetIds.flat()))
    const ids = new Set<number>()
    for (const w of report.widgets) {
      if (w.widgetType !== 'FILTER') continue
      const wid = w.id ?? w.widgetId
      if (wid === undefined || inContainers.has(wid)) continue // skip filters inside containers
      try {
        const cc = JSON.parse(w.chartConfig || '{}') as Record<string, unknown>
        const col = cc.filterColumn as string | undefined
        if (col && !usedParamNames.has(col)) ids.add(wid)
      } catch { /* ignore */ }
    }
    return ids
  }, [report, usedParamNames, containers])

  if (loading) return <LoadingSpinner />
  if (!report) return <div className="text-center py-12 text-slate-500">{t('reports.report_not_found')}</div>

  const parsePosition = (pos?: string) => {
    if (!pos) return { x: 0, y: 0, w: 12, h: 4 }
    try { return JSON.parse(pos) } catch { return { x: 0, y: 0, w: 12, h: 4 } }
  }

  const parseStyle = (style?: string) => {
    if (!style) return {}
    try { return JSON.parse(style) as Record<string, unknown> } catch { return {} }
  }

  const NON_DATA_WIDGETS = new Set(['TEXT', 'IMAGE', 'BUTTON', 'WEBPAGE', 'SPACER', 'DIVIDER'])

  const renderSingleWidget = (w: RenderReportResponse['widgets'][number]) => {
    const widgetDrillActions = drillActions[w.widgetId] || []
    const hasDrill = widgetDrillActions.length > 0
    const originalWidget = report?.widgets.find(ow => (ow.id ?? ow.widgetId) === w.widgetId)
    const showMenu = !NON_DATA_WIDGETS.has(w.widgetType)
    const drillEntry = getDrillEntryForTarget(w.widgetId)
    const filtered = applyClientFilters(w)
    return (
      <div
        key={w.widgetId}
        className={`card p-4 overflow-hidden h-full ${hasDrill ? 'ring-1 ring-brand-200 dark:ring-brand-800' : ''}`}
        style={{ position: 'relative' }}
      >
        {showMenu && (
          <div className="absolute top-2 right-2 z-10">
            <WidgetContextMenu
              rawSql={originalWidget?.rawSql}
              datasourceId={originalWidget?.datasourceId}
              data={w.data}
              title={w.title}
              parameters={currentParams}
            />
          </div>
        )}
        {drillEntry && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
            <button
              onClick={() => useActionStore.getState().undoDrillReplace(drillEntry.sourceWidgetId)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('widget_menu.drill_back')}
            </button>
            {(drillEntry.label || drillEntry.seriesName) && (
              <span className="text-xs text-slate-400">
                {drillEntry.label}{drillEntry.seriesName ? ` / ${drillEntry.seriesName}` : ''}
              </span>
            )}
          </div>
        )}
        {hasDrill && (
          <div className="text-[10px] text-brand-500 dark:text-brand-400 mb-1 flex items-center gap-1">
            <span>{'->'}</span>
            <span>{t('reports.drill_to', { name: widgetDrillActions[0].targetReportName })}</span>
          </div>
        )}
        <WidgetRenderer
          widget={filtered}
          drillActions={widgetDrillActions}
          onDrillDown={hasDrill ? (data) => handleDrillDown(w.widgetId, data) : undefined}
          layers={interactiveMeta?.chartLayers?.[w.widgetId] || []}
          reportId={currentReportId || report?.id || 0}
          onToggleWidgets={handleToggleWidgets}
          onApplyFilter={handleApplyFilter}
          onChartClick={(data) => {
            useActionStore.getState().triggerAction(w.widgetId, 'CLICK', data)
          }}
        />
      </div>
    )
  }

  const renderWidgets = () => {
    // All widget IDs that belong to any container — excluded from flat grid
    const tabsContainers = containers
    const widgetIdsInTabs = new Set(containers.flatMap(c => c.childWidgetIds.flat()))

    const widgetById = renderResult
      ? Object.fromEntries(renderResult.widgets.map(w => [w.widgetId, w]))
      : {}

    return (
      <>
        {(() => {
          const bookmarkOffsetClass =
            (filterPanelPosition === 'left' && filterPanelCollapsed) ? 'pl-20' :
              (filterPanelPosition === 'right' && filterPanelCollapsed) ? 'pr-20' :
                ''
          return (
            <BookmarkBar
              reportId={currentReportId || report?.id || 0}
              currentParameters={currentParams}
              className={bookmarkOffsetClass}
              onApplyBookmark={(params) => {
                setCurrentParams(params)
                handleRender(params)
              }}
            />
          )
        })()}

        {rendering && !renderResult ? (
          <LoadingSpinner />
        ) : renderResult ? (
          <div className="space-y-4">
            {/* TABS containers */}
            {tabsContainers.map(container => {
              // Each group = one tab; filter out hidden widgets, keep original index for labels
              const tabGroupsWithIdx = container.childWidgetIds
                .map((group, origIdx) => ({
                  origIdx,
                  widgets: group.map(wid => widgetById[wid]).filter(Boolean).filter(w => !isWidgetHidden(w.widgetId)),
                }))
                .filter(g => g.widgets.length > 0)
              if (tabGroupsWithIdx.length === 0) return null

              const tabGroups = tabGroupsWithIdx.map(g => g.widgets)

              // Tab height = max(y + h) across all widgets in the tallest tab
              const tabH = Math.max(...tabGroups.map(group =>
                group.reduce((maxH, w) => {
                  const pos = parsePosition(w.position)
                  return Math.max(maxH, (Number(pos.y) || 0) + Math.max(1, Number(pos.h) || 4))
                }, 0)
              ))

              const tabLabels = tabGroupsWithIdx.map(g =>
                container.tabNames[g.origIdx] || ''
              )

              return (
                <div key={container.id} className="card p-2" style={{ minHeight: `${tabH * 70 + 56}px` }}>
                  <TabContainer
                    container={container}
                    labels={tabLabels}
                    onTabChange={(idx) => setActiveTabByContainer(prev => ({ ...prev, [container.id]: idx }))}
                  >
                    {tabGroups.map((group, tabIdx) => (
                      <div key={tabIdx} className="grid grid-cols-12 gap-4 pt-2" style={{ gridAutoRows: '70px' }}>
                        {group.map(w => {
                          const pos = parsePosition(w.position)
                          const x = Math.max(0, Number(pos.x) || 0)
                          const y = Math.max(0, Number(pos.y) || 0)
                          const wSpan = Math.min(12, Math.max(1, Number(pos.w) || 12))
                          const hSpan = Math.max(1, Number(pos.h) || 4)
                          const styleCfg = parseStyle(w.style)
                          const zIndex = Number(styleCfg.zIndex ?? 0)
                          return (
                            <div key={w.widgetId} style={{
                              gridColumn: `${x + 1} / span ${wSpan}`,
                              gridRow: `${y + 1} / span ${hSpan}`,
                              zIndex,
                              position: 'relative',
                            }}>
                              {renderSingleWidget(w)}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </TabContainer>
                </div>
              )
            })}

            {/* Flat grid for widgets not in any container */}
            {renderResult.widgets.filter(w =>
              !isWidgetHidden(w.widgetId) && !widgetIdsInTabs.has(w.widgetId) && !autoHiddenFilterIds.has(w.widgetId)
            ).length > 0 && (
              <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: '70px' }}>
                {renderResult.widgets
                  .filter(w => !isWidgetHidden(w.widgetId) && !widgetIdsInTabs.has(w.widgetId) && !autoHiddenFilterIds.has(w.widgetId))
                  .map((w) => {
                    const pos = parsePosition(w.position)
                    const x = Math.max(0, Number(pos.x) || 0)
                    const y = Math.max(0, Number(pos.y) || 0)
                    const wSpan = Math.min(12, Math.max(1, Number(pos.w) || 12))
                    const hSpan = Math.max(1, Number(pos.h) || 4)
                    const styleCfg = parseStyle(w.style)
                    const zIndex = Number(styleCfg.zIndex ?? 0)
                    return (
                      <div
                        key={w.widgetId}
                        style={{
                          gridColumn: `${x + 1} / span ${wSpan}`,
                          gridRow: `${y + 1} / span ${hSpan}`,
                          zIndex,
                          position: 'relative',
                        }}
                      >
                        {renderSingleWidget(w)}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        ) : null}

        {interactiveMeta?.overlays && interactiveMeta.overlays.length > 0 && (
          <div className="relative">
            <OverlayLayer overlays={interactiveMeta.overlays} />
          </div>
        )}
      </>
    )
  }

  const sidePanel = report.parameters.length > 0 && visibleParameters.length > 0 && (
    <div className="flex flex-shrink-0" style={{ width: filterPanelCollapsed ? 0 : `${filterPanelWidth}px` }}>
      <div className={`flex-1 min-w-0 ${filterPanelCollapsed ? 'overflow-hidden' : ''}`}>
        <div className="sticky top-3">
          <div className="card p-2 mb-2">
            <div className="flex items-center justify-between gap-2">
              {!filterPanelCollapsed && (
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('widgets.type.filter')}
                </span>
              )}
              <button
                onClick={() => setFilterPanelCollapsed(v => !v)}
                className="btn-ghost text-xs px-2 py-1 w-full"
                title={t('reports.hide_filters')}
              >
                {t('reports.hide_filters')}
              </button>
            </div>
          </div>
          {!filterPanelCollapsed && (
            <EnhancedParameterPanel
              reportId={report?.id || 0}
              parameters={visibleParameters}
              onApply={handleRender}
              loading={rendering}
              compact
              currentParameters={currentParams}
            />
          )}
        </div>
      </div>
      {/* Drag handle for resizing filter panel */}
      {!filterPanelCollapsed && (
        <div
          className="w-1 cursor-col-resize hover:bg-brand-300 dark:hover:bg-brand-700 active:bg-brand-400 transition-colors flex-shrink-0"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = filterPanelWidth
            const isRight = filterPanelPosition === 'right'
            const onMove = (me: MouseEvent) => {
              const delta = me.clientX - startX
              setFilterPanelWidth(Math.max(200, Math.min(600, startW + (isRight ? -delta : delta))))
            }
            const onUp = () => {
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
            }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }}
        />
      )}
    </div>
  )

  return (
    <div className="-m-6 p-2 md:p-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{report.name}</h1>
            {report.description && <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{report.description}</p>}
          </div>
          <FavoriteButton objectType="REPORT" objectId={report?.id || 0} size={20} />
        </div>
        <div className="flex items-center gap-1.5">
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
              className="input text-xs w-24 py-0.5"
            >
              <option value="">{t('common.off')}</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
              <option value="300">5m</option>
            </select>
          </div>
          <button onClick={() => handleRender()} disabled={rendering} className="btn-secondary text-xs py-1">
            <RefreshCw className={`w-4 h-4 ${rendering ? 'animate-spin' : ''}`} /> {t('common.refresh')}
          </button>
          <button
            onClick={() => { reportApi.createSnapshot(report?.id || 0); toast.success(t('reports.snapshot_created')) }}
            className="btn-secondary text-xs py-1"
          >
            <Camera className="w-4 h-4" /> {t('reports.snapshot')}
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/reports/${report.slug}`
              navigator.clipboard.writeText(url)
              toast.success(t('common.link_copied'))
            }}
            className="btn-ghost text-xs py-1"
            title={t('common.copy_link')}
          >
            <Link2 className="w-4 h-4" />
          </button>
          <ExportMenu reportId={report?.id || 0} reportName={report.name} />
        </div>
      </div>

      <DrillDownBreadcrumb stack={navStack} onNavigate={handleBreadcrumbNavigate} />

      {report.parameters.length > 0 && visibleParameters.length > 0 && (filterPanelPosition === 'top' || filterPanelPosition === 'bottom') && (
        <div className="card p-3 mb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('widgets.type.filter')}</span>
            <button
              onClick={() => setFilterPanelCollapsed(v => !v)}
              className="btn-ghost text-xs px-2 py-1"
            >
              {filterPanelCollapsed ? t('reports.show_filters') : t('reports.hide_filters')}
            </button>
          </div>
        </div>
      )}

      {report.parameters.length > 0 && visibleParameters.length > 0 && filterPanelPosition === 'top' && !filterPanelCollapsed && (
        <EnhancedParameterPanel
          reportId={report?.id || 0}
          parameters={report.parameters}
          onApply={handleRender}
          loading={rendering}
          className="mb-4"
          currentParameters={currentParams}
        />
      )}

      {(filterPanelPosition === 'left' || filterPanelPosition === 'right') ? (
        <div className={`relative flex gap-4 ${filterPanelPosition === 'right' ? 'flex-row-reverse' : ''}`}>
          {sidePanel}
          {filterPanelCollapsed && report.parameters.length > 0 && visibleParameters.length > 0 && (
            <button
              onClick={() => setFilterPanelCollapsed(false)}
              className={`absolute top-0 z-20 btn-secondary text-xs px-3 py-1 ${filterPanelPosition === 'right' ? 'right-0' : 'left-0'}`}
              title={t('reports.show_filters')}
            >
              {t('reports.filters_short')}
            </button>
          )}
          <div className="flex-1 min-w-0">
            {renderWidgets()}
          </div>
        </div>
      ) : (
        <>
          {renderWidgets()}
        </>
      )}

      {report.parameters.length > 0 && visibleParameters.length > 0 && filterPanelPosition === 'bottom' && !filterPanelCollapsed && (
        <EnhancedParameterPanel
          reportId={report?.id || 0}
          parameters={report.parameters}
          onApply={handleRender}
          loading={rendering}
          className="mt-4"
          currentParameters={currentParams}
        />
      )}
    </div>
  )
}
