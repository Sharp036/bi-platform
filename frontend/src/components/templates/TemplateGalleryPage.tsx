import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { templateApi, type TemplateItem, type ReportExportConfig } from '@/api/templates'
import { datasourceApi } from '@/api/datasources'
import type { DataSource } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import {
  LayoutTemplate, Download, Upload, X, Copy, Tag
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function TemplateGalleryPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | undefined>()
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)

  // Use-template modal
  const [showCreate, setShowCreate] = useState(false)
  const [createTemplateId, setCreateTemplateId] = useState<number | null>(null)
  const [createName, setCreateName] = useState('')

  // Import modal
  const [showImport, setShowImport] = useState(false)
  const [importConfig, setImportConfig] = useState<ReportExportConfig | null>(null)
  const [importName, setImportName] = useState('')
  const [importDsId, setImportDsId] = useState<number | null>(null)
  const [importAsTemplate, setImportAsTemplate] = useState(false)
  const [importing, setImporting] = useState(false)

  // Export modal
  const [showExport, setShowExport] = useState(false)
  const [exportReportId, setExportReportId] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      templateApi.list(activeCategory).then(setTemplates),
      templateApi.getCategories().then(setCategories),
      datasourceApi.list().then(d => { setDatasources(d); if (!importDsId && d.length > 0) setImportDsId(d[0].id) }),
    ]).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [activeCategory])

  // ─── Use template ───
  const handleUseTemplate = (t: TemplateItem) => {
    setCreateTemplateId(t.id)
    setCreateName(`${t.name} (copy)`)
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (!createTemplateId || !createName.trim()) return
    try {
      const report = await templateApi.createFromTemplate(createTemplateId, createName.trim())
      toast.success('Report created from template')
      setShowCreate(false)
      navigate(`/reports/${(report as { id: number }).id}/edit`)
    } catch { toast.error('Failed to create') }
  }

  // ─── Export ───
  const handleExport = async () => {
    const id = Number(exportReportId)
    if (!id) return
    try {
      const config = await templateApi.exportReport(id)
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${config.name.replace(/\s+/g, '_')}.datorio.json`
      a.click(); URL.revokeObjectURL(url)
      setShowExport(false)
      toast.success('Exported')
    } catch { toast.error('Export failed') }
  }

  const handleExportTemplate = async (t: TemplateItem) => {
    try {
      const config = await templateApi.exportReport(t.id)
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${config.name.replace(/\s+/g, '_')}.datorio.json`
      a.click(); URL.revokeObjectURL(url)
      toast.success('Exported')
    } catch { toast.error('Export failed') }
  }

  // ─── Import ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string) as ReportExportConfig
        if (!config.formatVersion || !config.name || !config.widgets) {
          toast.error('Invalid config file format'); return
        }
        setImportConfig(config)
        setImportName(config.name)
        setShowImport(true)
      } catch { toast.error('Invalid JSON file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!importConfig) return
    setImporting(true)
    try {
      const result = await templateApi.importReport({
        config: importConfig,
        name: importName.trim() || undefined,
        datasourceId: importDsId || undefined,
        asTemplate: importAsTemplate,
      })
      toast.success(`Imported: ${result.widgetCount} widgets, ${result.parameterCount} params`)
      setShowImport(false); setImportConfig(null)
      if (importAsTemplate) load()
      else navigate(`/reports/${result.reportId}/edit`)
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Template Gallery</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowExport(true)} className="btn-secondary">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <Upload className="w-4 h-4" /> Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          <button onClick={() => setActiveCategory(undefined)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                    !activeCategory ? 'bg-brand-600 text-white' : 'bg-surface-100 dark:bg-dark-surface-100 text-slate-600 dark:text-slate-400 hover:bg-surface-200'
                  }`}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                      activeCategory === cat ? 'bg-brand-600 text-white' : 'bg-surface-100 dark:bg-dark-surface-100 text-slate-600 dark:text-slate-400 hover:bg-surface-200'
                    }`}>
              <Tag className="w-3 h-3 inline mr-1" />{cat}
            </button>
          ))}
        </div>
      )}

      {/* Template grid */}
      {templates.length === 0 ? (
        <EmptyState icon={<LayoutTemplate className="w-12 h-12" />} title="No templates yet"
                    description="Mark a report as template or import a .datorio.json config file" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card overflow-hidden hover:shadow-md transition-shadow">
              {/* Preview area */}
              <div className="h-32 bg-gradient-to-br from-brand-50 to-violet-50 dark:from-brand-900/20 dark:to-violet-900/20 flex items-center justify-center">
                {t.thumbnailUrl
                  ? <img src={t.thumbnailUrl} alt={t.name} className="w-full h-full object-cover" />
                  : <LayoutTemplate className="w-12 h-12 text-brand-300 dark:text-brand-700" />
                }
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-slate-800 dark:text-white truncate">{t.name}</h3>
                {t.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{t.description}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                  <span>{t.widgetCount} widgets</span>
                  {t.category && <span className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-dark-surface-100">{t.category}</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleUseTemplate(t)} className="btn-primary text-xs flex-1">
                    <Copy className="w-3.5 h-3.5" /> Use Template
                  </button>
                  <button onClick={() => handleExportTemplate(t)} className="btn-ghost text-xs p-2" title="Export JSON">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Use template modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-sm p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Create from Template</h2>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <input value={createName} onChange={e => setCreateName(e.target.value)}
                   placeholder="Report name" className="input mb-4" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={!createName.trim()} className="btn-primary">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export modal ── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-sm p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Export Report Config</h2>
              <button onClick={() => setShowExport(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <input type="number" value={exportReportId} onChange={e => setExportReportId(e.target.value)}
                   placeholder="Report ID" className="input mb-1" autoFocus />
            <p className="text-xs text-slate-400 mb-4">Enter the ID of any report to export its configuration</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExport(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleExport} disabled={!exportReportId} className="btn-primary">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import modal ── */}
      {showImport && importConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Import Config</h2>
              <button onClick={() => { setShowImport(false); setImportConfig(null) }} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            {/* Preview */}
            <div className="card p-3 mb-4 bg-surface-50 dark:bg-dark-surface-50">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{importConfig.name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {importConfig.widgets.length} widgets · {importConfig.parameters.length} parameters
                {importConfig.category && ` · ${importConfig.category}`}
              </p>
            </div>
            <div className="space-y-3">
              <input value={importName} onChange={e => setImportName(e.target.value)}
                     placeholder="Report name (optional override)" className="input" />
              <select value={importDsId || ''} onChange={e => setImportDsId(Number(e.target.value) || null)} className="input">
                <option value="">No datasource (keep original SQL)</option>
                {datasources.map(ds => <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={importAsTemplate} onChange={e => setImportAsTemplate(e.target.checked)}
                       className="w-4 h-4 rounded border-surface-300" />
                Import as template (add to gallery)
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowImport(false); setImportConfig(null) }} className="btn-secondary">Cancel</button>
              <button onClick={handleImport} disabled={importing} className="btn-primary">
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
