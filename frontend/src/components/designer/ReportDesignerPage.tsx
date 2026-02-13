import { useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportApi } from '@/api/reports'
import { useDesignerStore } from '@/store/useDesignerStore'
import ComponentPalette from './ComponentPalette'
import DesignerCanvas from './DesignerCanvas'
import PropertyPanel from './PropertyPanel'
import ParameterDesigner from './ParameterDesigner'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  Save, Undo2, Redo2, Eye, EyeOff, ArrowLeft,
  Upload, Settings2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useState } from 'react'

export default function ReportDesignerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const {
    reportId, reportName, reportDescription, reportStatus,
    widgets, parameters, dirty, previewMode,
    setReportMeta, loadReport, togglePreview,
    undo, redo, canUndo, canRedo, reset, setDirty,
  } = useDesignerStore()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Load existing report
  useEffect(() => {
    if (isNew) {
      reset()
      setReportMeta('New Report', '')
      return
    }
    setLoading(true)
    reportApi.get(Number(id))
      .then(data => {
        loadReport({
          id: data.id,
          name: data.name,
          description: data.description || '',
          status: data.status,
          widgets: data.widgets as Array<Record<string, unknown>>,
          parameters: data.parameters as Array<Record<string, unknown>>,
        })
      })
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false))
  }, [id, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!reportName.trim()) { toast.error('Report name is required'); return }

    setSaving(true)
    try {
      const widgetPayloads = widgets.map((w, i) => ({
        widgetType: w.widgetType,
        title: w.title,
        queryId: w.queryId,
        datasourceId: w.datasourceId,
        rawSql: w.rawSql || null,
        chartConfig: JSON.stringify(w.chartConfig),
        position: JSON.stringify(w.position),
        style: JSON.stringify(w.style),
        paramMapping: JSON.stringify(w.paramMapping),
        sortOrder: i,
        isVisible: w.isVisible,
      }))

      const paramPayloads = parameters.map((p, i) => ({
        ...p,
        sortOrder: i,
      }))

      if (isNew || !reportId) {
        const created = await reportApi.create({
          name: reportName,
          description: reportDescription,
          widgets: widgetPayloads,
          parameters: paramPayloads,
        })
        toast.success('Report created')
        setDirty(false)
        navigate(`/reports/${created.id}/edit`, { replace: true })
      } else {
        // Update report metadata
        await reportApi.update(reportId, {
          name: reportName,
          description: reportDescription,
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

        toast.success('Report saved')
        setDirty(false)
      }
    } catch {
      toast.error('Failed to save report')
    } finally {
      setSaving(false)
    }
  }, [reportName, reportDescription, widgets, parameters, isNew, reportId, navigate, setDirty])

  const handlePublish = async () => {
    if (!reportId) { toast.error('Save first'); return }
    try {
      await reportApi.publish(reportId)
      toast.success('Published!')
    } catch { toast.error('Failed to publish') }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-surface-50 border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
        <button onClick={() => navigate('/reports')} className="btn-ghost p-2" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <input
          value={reportName}
          onChange={e => setReportMeta(e.target.value, reportDescription)}
          className="text-lg font-bold bg-transparent border-none outline-none text-slate-800 dark:text-white min-w-0 flex-1"
          placeholder="Report name"
        />

        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={!canUndo()} className="btn-ghost p-2" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={!canRedo()} className="btn-ghost p-2" title="Redo (Ctrl+Y)">
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-surface-200 dark:bg-dark-surface-100 mx-1" />

          <button onClick={togglePreview} className="btn-ghost p-2" title="Preview">
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="btn-ghost p-2" title="Settings">
            <Settings2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-surface-200 dark:bg-dark-surface-100 mx-1" />

          {reportId && (
            <button onClick={handlePublish} className="btn-secondary text-sm">
              <Upload className="w-4 h-4" /> Publish
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="px-4 py-3 bg-surface-50 dark:bg-dark-surface-100/50 border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
          <div className="flex items-center gap-4 max-w-[800px]">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
              <input
                value={reportDescription}
                onChange={e => setReportMeta(reportName, e.target.value)}
                className="input text-sm" placeholder="Report description"
              />
            </div>
            <div className="w-32">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
              <span className="text-sm text-slate-600 dark:text-slate-400">{reportStatus}</span>
            </div>
          </div>

          {/* Parameters */}
          <div className="mt-3">
            <ParameterDesigner />
          </div>
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
          Unsaved changes
        </div>
      )}
    </div>
  )
}
