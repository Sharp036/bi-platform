import { useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { reportApi } from '@/api/reports'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { ReportParameter } from '@/types'
import ComponentPalette from './ComponentPalette'
import DesignerCanvas from './DesignerCanvas'
import PropertyPanel from './PropertyPanel'
import ParameterDesigner from './ParameterDesigner'
import ParameterControlConfigPanel from '@/components/interactive/ParameterControlConfigPanel'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  Save, Undo2, Redo2, Eye, EyeOff, ArrowLeft,
  Upload, Download, Settings2
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
    undo, redo, canUndo, canRedo, reset, setDirty,
  } = useDesignerStore()

  const isPublished = reportStatus === 'PUBLISHED'
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [filterPanelPosition, setFilterPanelPosition] = useState<FilterPanelPosition>('top')
  const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false)
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
      setReportMeta(t('designer.new_report_name'), '')
      const defaults = parseReportLayout()
      setFilterPanelPosition(defaults.filterPanel.position)
      setFilterPanelCollapsed(defaults.filterPanel.collapsed)
      nameEditedRef.current = false
      return
    }
    nameEditedRef.current = true
    setLoading(true)
    reportApi.get(Number(id))
      .then(data => {
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
        navigate(`/reports/${created.id}/edit`, { replace: true })
        toast.success(t('designer.report_created'))
        setDirty(false)
        navigate(`/reports/${created.id}/edit`, { replace: true })
      } else {
        // Update report metadata
        await reportApi.update(reportId, {
          name: reportName,
          description: reportDescription,
          layout,
        })

        // Update parameters
        await reportApi.setParameters(reportId, paramPayloads)

        // Delete existing widgets & re-create
        // (simpler than diffing; server handles cascade)
        const existingWidgets = await reportApi.getWidgets(reportId) as Array<{ id: number }>
        for (const ew of existingWidgets) {
          await reportApi.deleteWidget(ew.id)
        }
        for (const wp of widgetPayloads) {
          await reportApi.addWidget(reportId, wp)
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

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="px-4 py-3 bg-surface-50 dark:bg-dark-surface-100/50 border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
          <div className="flex items-center gap-4 max-w-[800px]">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t('designer.description_label')}</label>
              <input
                value={reportDescription}
                onChange={e => setReportMeta(reportName, e.target.value)}
                className="input text-sm" placeholder={t('designer.report_desc_placeholder')}
              />
            </div>
            <div className="w-32">
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t('designer.status_label')}</label>
              <span className="text-sm text-slate-600 dark:text-slate-400">{reportStatus}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[800px] mt-3">
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
            <div className="flex items-end">
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

          {/* Parameters */}
          <div className="mt-3">
            <ParameterDesigner />
          </div>
          {reportId && (
            <div className="mt-4">
              <ParameterControlConfigPanel
                reportId={reportId}
                parameters={controlParams}
              />
            </div>
          )}
        </div>
      )}

      {/* Main area: palette + canvas + properties */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Component Palette */}
        {!previewMode && (
          <div className="w-52 flex-shrink-0 p-3 overflow-y-auto border-r border-surface-200 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/30">
            <ComponentPalette />
          </div>
        )}

        {/* Center: Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-surface-100/50 dark:bg-dark-surface-100/20">
          <DesignerCanvas />
        </div>

        {/* Right: Property Panel */}
        {!previewMode && (
          <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-surface-200 dark:border-dark-surface-100 bg-surface-50 dark:bg-dark-surface-100/30">
            <PropertyPanel />
          </div>
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
