import { useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { reportApi } from '@/api/reports'
import { vizApi } from '@/api/visualization'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { ReportParameter } from '@/types'
import ComponentPalette from './ComponentPalette'
import DesignerCanvas from './DesignerCanvas'
import PropertyPanel from './PropertyPanel'
import ParameterDesigner from './ParameterDesigner'
import ParameterControlConfigPanel from '@/components/interactive/ParameterControlConfigPanel'
import ContainerDesigner, { DesignerContainer, genContainerId } from './ContainerDesigner'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  Save, Undo2, Redo2, Eye, EyeOff, ArrowLeft,
  Upload, Download, Settings2, Layers, SlidersHorizontal, ExternalLink,
  PanelRightClose, PanelRightOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useState } from 'react'

type FilterPanelPosition = 'top' | 'bottom' | 'left' | 'right'

const defaultLayoutConfig = {
  filterPanel: {
    position: 'top' as FilterPanelPosition,
    collapsed: false,
  },
}

function parseReportLayout(layout?: string) {
  if (!layout) return defaultLayoutConfig
  try {
    const parsed = JSON.parse(layout) as {
      filterPanel?: { position?: FilterPanelPosition; collapsed?: boolean }
    }
    const position = parsed.filterPanel?.position
    const collapsed = parsed.filterPanel?.collapsed
    return {
      filterPanel: {
        position: position === 'top' || position === 'bottom' || position === 'left' || position === 'right'
          ? position
          : defaultLayoutConfig.filterPanel.position,
        collapsed: !!collapsed,
      },
    }
  } catch {
    return defaultLayoutConfig
  }
}

export default function ReportDesignerPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const nameEditedRef = useRef(false)

  const {
    reportId, reportName, reportDescription, reportStatus,
    widgets, parameters, dirty, previewMode,
    setReportMeta, loadReport, togglePreview,
    undo, redo, canUndo, canRedo, reset, setDirty, setParameters,
  } = useDesignerStore()

  const isPublished = reportStatus === 'PUBLISHED'
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [filterPanelPosition, setFilterPanelPosition] = useState<FilterPanelPosition>('top')
  const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false)
  const [containers, setContainers] = useState<DesignerContainer[]>([])
  const [rightPanel, setRightPanel] = useState<'props' | 'containers'>('props')
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(288) // 18rem = 288px (w-72)
  const [settingsPanelWidth, setSettingsPanelWidth] = useState(380)
  const controlParams: ReportParameter[] = parameters.map(p => ({
    name: p.name,
    label: p.label,
    paramType: p.paramType as ReportParameter['paramType'],
    defaultValue: p.defaultValue,
    isRequired: p.isRequired,
    config: {},
  }))

  // Load existing report
  useEffect(() => {
    if (isNew) {
      reset()
      setContainers([])
      setReportMeta(t('designer.new_report_name'), '')
      const defaults = parseReportLayout()
      setFilterPanelPosition(defaults.filterPanel.position)
      setFilterPanelCollapsed(defaults.filterPanel.collapsed)
      nameEditedRef.current = false
      return
    }
    nameEditedRef.current = true
    setLoading(true)
    reportApi.get(id!)
      .then(async data => {
        const parsedLayout = parseReportLayout(data.layout)
        setFilterPanelPosition(parsedLayout.filterPanel.position)
        setFilterPanelCollapsed(parsedLayout.filterPanel.collapsed)
        loadReport({
          id: data.id,
          name: data.name,
          description: data.description || '',
          status: data.status,
          widgets: data.widgets as unknown as Array<Record<string, unknown>>,
          parameters: data.parameters as unknown as Array<Record<string, unknown>>,
        })

        // Load containers and map server widget IDs -> designer client IDs
        // The store widgets are set synchronously by loadReport above
        const storeWidgets = useDesignerStore.getState().widgets
        try {
          const serverContainers = await vizApi.getContainers(data.id)
          const mapped: DesignerContainer[] = serverContainers.map(sc => ({
            clientId: genContainerId(),
            serverId: sc.id,
            containerType: (sc.containerType === 'ACCORDION' ? 'ACCORDION' : 'TABS') as DesignerContainer['containerType'],
            name: sc.name ?? '',
            tabNames: sc.tabNames,
            // Map server widget IDs to client IDs via sortOrder position in the widget list
            tabGroups: sc.childWidgetIds.map(group =>
              group
                .map(servId => storeWidgets.find(w => w.serverId === servId)?.id ?? null)
                .filter((id): id is string => id !== null)
            ),
          }))
          setContainers(mapped)
        } catch {
          // Containers are optional — non-fatal
          setContainers([])
        }
      })
      .catch(() => toast.error(t('designer.failed_load')))
      .finally(() => setLoading(false))
  }, [id, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update default title on language change (only for new unsaved reports)
  useEffect(() => {
    if (isNew && !nameEditedRef.current) {
      setReportMeta(t('designer.new_report_name'), reportDescription)
    }
  }, [i18n.language]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!reportName.trim()) { toast.error(t('designer.report_name_required')); return }
    const normalizedParamNames = parameters.map(p => (p.name || '').trim()).filter(Boolean)
    const hasDuplicateParamNames = new Set(normalizedParamNames).size !== normalizedParamNames.length
    if (hasDuplicateParamNames) {
      toast.error('Duplicate parameter names are not allowed')
      return
    }

    setSaving(true)
    try {
      const widgetPayloads = widgets.map((w, i) => {
        const hasInlineSql = !!(w.datasourceId && w.rawSql?.trim())
        return {
          widgetType: w.widgetType,
          title: w.title,
          queryId: hasInlineSql ? null : w.queryId,
          datasourceId: w.datasourceId,
          rawSql: hasInlineSql ? w.rawSql : null,
          chartConfig: JSON.stringify(w.chartConfig),
          position: JSON.stringify(w.position),
          style: JSON.stringify(w.style),
          paramMapping: JSON.stringify(w.paramMapping),
          sortOrder: i,
          isVisible: w.isVisible,
        }
      })

      const paramPayloads = parameters.map((p, i) => ({
        ...p,
        name: p.name.trim(),
        sortOrder: i,
      }))
      const layout = JSON.stringify({
        filterPanel: {
          position: filterPanelPosition,
          collapsed: filterPanelCollapsed,
        },
      })

      if (isNew || !reportId) {
        const created = await reportApi.create({
          name: reportName,
          description: reportDescription,
          layout,
          widgets: widgetPayloads,
          parameters: paramPayloads,
        })
        loadReport({
          id: created.id,
          name: created.name,
          description: created.description || '',
          status: created.status,
          widgets: created.widgets as any,
          parameters: created.parameters as any,
        })
        // Save containers using the freshly assigned server widget IDs
        if (containers.length > 0) {
          const createdWidgets = (created.widgets as unknown as Array<{ id: number; sortOrder: number }>)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          // client widget at index i -> server widget id createdWidgets[i].id
          const clientIdToServerId = new Map<string, number>(
            widgets.map((w, i) => [w.id, createdWidgets[i]?.id ?? -1])
          )
          for (const c of containers) {
            await vizApi.createContainer({
              reportId: created.id,
              containerType: c.containerType,
              name: c.name,
              tabNames: c.tabNames,
              activeTab: 0,
              childWidgetIds: c.tabGroups.map(g =>
                g.map(cid => clientIdToServerId.get(cid) ?? -1).filter(id => id !== -1)
              ),
            })
          }
        }
        navigate(`/reports/${created.slug}/edit`, { replace: true })
        toast.success(t('designer.report_created'))
        setDirty(false)
        navigate(`/reports/${created.slug}/edit`, { replace: true })
      } else {
        // Update report metadata
        await reportApi.update(reportId, {
          name: reportName,
          description: reportDescription,
          layout,
        })

        // Update parameters
        await reportApi.setParameters(reportId, paramPayloads)

        // Update existing widgets in-place (preserves server IDs) or create new ones.
        // Never delete-all-recreate — that breaks container ID references.
        const existingWidgets = await reportApi.getWidgets(reportId) as Array<{ id: number }>
        const existingServerIdSet = new Set(existingWidgets.map(w => w.id))

        const clientIdToServerId = new Map<string, number>()
        for (let i = 0; i < widgets.length; i++) {
          const w = widgets[i]
          const wp = widgetPayloads[i]
          if (w.serverId && existingServerIdSet.has(w.serverId)) {
            await reportApi.updateWidget(w.serverId, wp)
            clientIdToServerId.set(w.id, w.serverId)
          } else {
            const created = await reportApi.addWidget(reportId, wp) as { id: number }
            clientIdToServerId.set(w.id, created.id)
          }
        }

        // Delete any server widgets that no longer exist in the store
        const keptServerIds = new Set(clientIdToServerId.values())
        for (const ew of existingWidgets) {
          if (!keptServerIds.has(ew.id)) {
            await reportApi.deleteWidget(ew.id)
          }
        }
        const existingContainers = await vizApi.getContainers(reportId)
        for (const ec of existingContainers) {
          await vizApi.deleteContainer(ec.id)
        }
        for (const c of containers) {
          await vizApi.createContainer({
            reportId,
            containerType: c.containerType,
            name: c.name,
            tabNames: c.tabNames,
            activeTab: 0,
            childWidgetIds: c.tabGroups.map(g =>
              g.map(cid => clientIdToServerId.get(cid) ?? -1).filter(id => id !== -1)
            ),
          })
        }

        toast.success(t('designer.report_saved'))
        setDirty(false)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('designer.failed_save'))
    } finally {
      setSaving(false)
    }
  }, [
    reportName,
    reportDescription,
    widgets,
    parameters,
    containers,
    filterPanelPosition,
    filterPanelCollapsed,
    isNew,
    reportId,
    navigate,
    setDirty,
  ])

  const handlePublish = async () => {
    if (!reportId) { toast.error(t('designer.save_first')); return }
    try {
      if (isPublished) {
        await reportApi.unpublish(reportId)
        useDesignerStore.setState({ reportStatus: 'DRAFT' })
        toast.success(t('designer.unpublished'))
      } else {
        await reportApi.publish(reportId)
        useDesignerStore.setState({ reportStatus: 'PUBLISHED' })
        toast.success(t('designer.published'))
      }
    } catch {
      toast.error(isPublished ? t('designer.failed_unpublish') : t('designer.failed_publish'))
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-surface-50 border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
        <button onClick={() => navigate('/reports')} className="btn-ghost p-2" title={t('common.back')}>
          <ArrowLeft className="w-4 h-4" />
        </button>

        <input
          value={reportName}
          onChange={e => { nameEditedRef.current = true; setReportMeta(e.target.value, reportDescription) }}
          className="text-lg font-bold bg-transparent border-none outline-none text-slate-800 dark:text-white min-w-0 flex-1"
          placeholder={t('designer.report_name_placeholder')}
        />

        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={!canUndo()} className="btn-ghost p-2" title={t('designer.undo')}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={!canRedo()} className="btn-ghost p-2" title={t('designer.redo')}>
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-surface-200 dark:bg-dark-surface-100 mx-1" />

          <button onClick={togglePreview} className="btn-ghost p-2" title={t('designer.preview')}>
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {reportId && (
            <button
              onClick={() => window.open(`/reports/${reportId}`, '_blank')}
              className="btn-ghost p-2"
              title={t('designer.open_in_viewer')}
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)} className="btn-ghost p-2" title={t('designer.settings')}>
            <Settings2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-surface-200 dark:bg-dark-surface-100 mx-1" />

          {reportId && (
            <button onClick={handlePublish} className="btn-secondary text-sm">
              {isPublished ? <Download className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {' '}{isPublished ? t('common.unpublish') : t('common.publish')}
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            <Save className="w-4 h-4" /> {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Main area: palette + canvas + properties */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Settings panel (resizable) */}
        {!previewMode && showSettings && (
          <div className="flex-shrink-0 flex" style={{ width: `${settingsPanelWidth}px` }}>
          <div className="flex-1 overflow-y-auto border-r border-surface-200 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/40 p-3 space-y-4 min-w-0">
            <div className="card p-3">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('designer.description_label')}</label>
                  <input
                    value={reportDescription}
                    onChange={e => setReportMeta(reportName, e.target.value)}
                    className="input text-sm" placeholder={t('designer.report_desc_placeholder')}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('designer.status_label')}</label>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{reportStatus}</span>
                </div>
              </div>
            </div>

            <div className="card p-3">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('designer.filter_panel_position')}</label>
                  <select
                    value={filterPanelPosition}
                    onChange={e => setFilterPanelPosition(e.target.value as FilterPanelPosition)}
                    className="input text-sm"
                  >
                    <option value="top">{t('designer.filter_panel_position.top')}</option>
                    <option value="bottom">{t('designer.filter_panel_position.bottom')}</option>
                    <option value="left">{t('designer.filter_panel_position.left')}</option>
                    <option value="right">{t('designer.filter_panel_position.right')}</option>
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={filterPanelCollapsed}
                    onChange={e => setFilterPanelCollapsed(e.target.checked)}
                  />
                  {t('designer.filter_panel_collapsed_default')}
                </label>
              </div>
            </div>

            <div className="card p-3">
              <ParameterDesigner />
            </div>

            {reportId && (
              <div className="card p-3">
                <ParameterControlConfigPanel
                  reportId={reportId}
                  parameters={controlParams}
                  onParameterDefaultChange={(paramName, value) => {
                    setParameters(parameters.map(p =>
                      p.name === paramName ? { ...p, defaultValue: value } : p
                    ))
                  }}
                />
              </div>
            )}
          </div>
          {/* Drag handle on right edge */}
          <div
            className="w-1 cursor-col-resize hover:bg-brand-300 dark:hover:bg-brand-700 active:bg-brand-400 transition-colors flex-shrink-0"
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startW = settingsPanelWidth
              const onMove = (me: MouseEvent) => {
                setSettingsPanelWidth(Math.max(250, Math.min(600, startW + (me.clientX - startX))))
              }
              const onUp = () => {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          />
          </div>
        )}

        {/* Left: Component Palette */}
        {!previewMode && (
          <div className="w-52 flex-shrink-0 p-3 overflow-y-auto border-r border-surface-200 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/30">
            <ComponentPalette />
          </div>
        )}

        {/* Center: Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-surface-100/50 dark:bg-dark-surface-100/20">
          <DesignerCanvas containers={containers} />
        </div>

        {/* Right: Property Panel / Container Designer */}
        {!previewMode && (
          <>
            {/* Collapsed: thin strip with expand button */}
            {rightPanelCollapsed ? (
              <div className="w-8 flex-shrink-0 flex flex-col items-center border-l border-surface-200 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/30">
                <button
                  onClick={() => setRightPanelCollapsed(false)}
                  className="p-1.5 mt-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title={t('designer.tabs.properties_panel')}
                >
                  <PanelRightOpen className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex-shrink-0 flex" style={{ width: `${rightPanelWidth}px` }}>
                {/* Drag-resize handle on left edge */}
                <div
                  className="w-1 cursor-col-resize hover:bg-brand-300 dark:hover:bg-brand-700 active:bg-brand-400 transition-colors flex-shrink-0"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const startX = e.clientX
                    const startW = rightPanelWidth
                    const onMove = (me: MouseEvent) => {
                      const newW = Math.max(200, Math.min(600, startW - (me.clientX - startX)))
                      setRightPanelWidth(newW)
                    }
                    const onUp = () => {
                      document.removeEventListener('mousemove', onMove)
                      document.removeEventListener('mouseup', onUp)
                    }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                />
                <div className="flex-1 flex flex-col border-l border-surface-200 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/30 min-w-0">
                  {/* Panel tabs + collapse button */}
                  <div className="flex border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
                    <button
                      onClick={() => setRightPanelCollapsed(true)}
                      className="px-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex-shrink-0"
                      title="Collapse"
                    >
                      <PanelRightClose className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setRightPanel('props')}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                        rightPanel === 'props'
                          ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                      title={t('designer.tabs.properties_panel')}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {t('designer.tabs.properties_panel')}
                    </button>
                    <button
                      onClick={() => setRightPanel('containers')}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                        rightPanel === 'containers'
                          ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                      title={t('designer.tabs.panel_title')}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {t('designer.tabs.panel_title')}
                      {containers.length > 0 && (
                        <span className="ml-1 bg-brand-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                          {containers.length}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {rightPanel === 'props'
                      ? <PropertyPanel />
                      : <ContainerDesigner containers={containers} onChange={setContainers} />
                    }
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs px-3 py-1 rounded-full">
          {t('designer.unsaved_changes')}
        </div>
      )}
    </div>
  )
}
