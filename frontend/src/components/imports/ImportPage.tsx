import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Upload, Database, FileSpreadsheet, CheckCircle, XCircle,
  Clock, Plus, Trash2, Pencil, Eye, X, ChevronDown, Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { importApi } from '@/api/import'
import type {
  ImportSource, ImportSourceForm, ImportSourceMappingForm,
  ImportLog, ImportPreviewResponse, ImportUploadResult, ImportErrorDetail,
} from '@/api/import'
import { datasourceApi } from '@/api/datasources'
import type { TableInfo } from '@/api/datasources'
import type { DataSource } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { useAuthStore } from '@/store/authStore'
import { apiKeyApi } from '@/api/apikeys'
import type { ApiKey, ApiKeyCreated } from '@/api/apikeys'

type Tab = 'sources' | 'upload' | 'history' | 'apikeys'

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const data = e['response'] && typeof e['response'] === 'object'
      ? (e['response'] as Record<string, unknown>)['data']
      : null
    if (typeof data === 'string' && data) return data
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      if (typeof d['message'] === 'string' && d['message']) return d['message']
      if (typeof d['error'] === 'string' && d['error']) return d['error']
    }
    if (typeof e['message'] === 'string' && e['message']) return e['message']
  }
  return fallback
}

const DATA_TYPES = ['string', 'integer', 'float', 'date', 'datetime', 'boolean'] as const
const LOAD_MODES = ['append', 'replace', 'upsert'] as const
const SOURCE_FORMATS = ['xlsx', 'csv', 'tsv', 'json', 'zip'] as const
const COMMON_ENCODINGS = ['UTF-8', 'UTF-16', 'windows-1251', 'windows-1252', 'ISO-8859-1', 'KOI8-R'] as const

const emptyMapping = (): ImportSourceMappingForm => ({
  sourceColumn: '', targetColumn: '', dataType: 'string', nullable: true, constValue: '',
})

const emptyForm = (): ImportSourceForm => ({
  name: '', description: '', datasourceId: 0,
  sourceFormat: 'xlsx', sheetName: '', headerRow: 1, skipRows: 0,
  targetSchema: 'public', targetTable: '',
  loadMode: 'append', keyColumns: [],
  filenamePattern: '', fileEncoding: 'UTF-8', jsonArrayPath: '',
  mappings: [emptyMapping()],
})

function statusBadge(status: ImportLog['status'], t: (k: string) => string) {
  const map: Record<ImportLog['status'], string> = {
    validating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    valid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    importing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {t(`import.status.${status}`)}
    </span>
  )
}

// ---- Source Form Modal ----

interface SourceFormModalProps {
  datasources: DataSource[]
  initial: ImportSourceForm
  editingId: number | null
  onClose: () => void
  onSaved: () => void
}

function SourceFormModal({ datasources, initial, editingId, onClose, onSaved }: SourceFormModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ImportSourceForm>(initial)
  const [saving, setSaving] = useState(false)
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [loadingColumns, setLoadingColumns] = useState(false)
  const sampleFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!form.datasourceId) { setAvailableTables([]); return }
    datasourceApi.schema(form.datasourceId).then(setAvailableTables).catch(() => setAvailableTables([]))
  }, [form.datasourceId])

  const setField = <K extends keyof ImportSourceForm>(key: K, value: ImportSourceForm[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const setMapping = (idx: number, patch: Partial<ImportSourceMappingForm>) =>
    setForm(f => {
      const mappings = [...f.mappings]
      mappings[idx] = { ...mappings[idx], ...patch }
      return { ...f, mappings }
    })

  const addMapping = () => setForm(f => ({ ...f, mappings: [...f.mappings, emptyMapping()] }))

  const removeMapping = (idx: number) =>
    setForm(f => ({ ...f, mappings: f.mappings.filter((_, i) => i !== idx) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        await importApi.updateSource(editingId, form)
        toast.success(t('import.updated'))
      } else {
        await importApi.createSource(form)
        toast.success(t('import.created'))
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(extractError(err, editingId ? t('import.failed_update') : t('import.failed_create')), { duration: 6000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-auto py-6">
      <div className="card w-full max-w-2xl p-6 mx-4 my-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {editingId ? t('common.edit') : t('import.new_source')}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <input
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            placeholder={t('import.source_name')}
            className="input"
          />
          <input
            value={form.description || ''}
            onChange={e => setField('description', e.target.value)}
            placeholder={t('common.description')}
            className="input"
          />

          <select
            value={form.datasourceId}
            onChange={e => {
              const id = Number(e.target.value)
              const ds = datasources.find(d => d.id === id)
              setField('datasourceId', id)
              if (ds) setField('targetSchema', ds.type === 'CLICKHOUSE' ? ds.databaseName : 'public')
            }}
            className="input"
          >
            <option value={0} disabled>{t('common.type')}...</option>
            {datasources.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.source_format')}</label>
              <select value={form.sourceFormat} onChange={e => setField('sourceFormat', e.target.value as ImportSourceForm['sourceFormat'])} className="input">
                {SOURCE_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
            {form.sourceFormat === 'xlsx' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('import.sheet_name')}</label>
                <input value={form.sheetName || ''} onChange={e => setField('sheetName', e.target.value)} className="input" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.header_row')}</label>
              <input type="number" min={1} value={form.headerRow} onChange={e => setField('headerRow', Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.skip_rows')}</label>
              <input type="number" min={0} value={form.skipRows} onChange={e => setField('skipRows', Number(e.target.value))} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.target_schema')}</label>
              <input value={form.targetSchema} onChange={e => setField('targetSchema', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.target_table')}</label>
              <input
                list="import-tables-list"
                value={form.targetTable}
                onChange={e => setField('targetTable', e.target.value)}
                placeholder={t('import.target_table_placeholder')}
                className="input"
              />
              {availableTables.length > 0 && (
                <datalist id="import-tables-list">
                  {availableTables.map(t => <option key={t.name} value={t.name} />)}
                </datalist>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('import.load_mode')}</label>
            <select value={form.loadMode} onChange={e => setField('loadMode', e.target.value as ImportSourceForm['loadMode'])} className="input">
              {LOAD_MODES.map(m => <option key={m} value={m}>{t(`import.load_mode.${m}`)}</option>)}
            </select>
          </div>

          {form.loadMode === 'upsert' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.key_columns')}</label>
              <input
                value={(form.keyColumns || []).join(', ')}
                onChange={e => setField('keyColumns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="id, code"
                className="input"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {form.sourceFormat !== 'xlsx' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.file_encoding')}</label>
              <input
                list="import-encodings-list"
                value={form.fileEncoding}
                onChange={e => setField('fileEncoding', e.target.value)}
                className="input"
              />
              <datalist id="import-encodings-list">
                {COMMON_ENCODINGS.map(enc => <option key={enc} value={enc} />)}
              </datalist>
            </div>
            )}
            {form.sourceFormat === 'zip' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('import.filename_pattern')}</label>
                <input
                  value={form.filenamePattern || ''}
                  onChange={e => setField('filenamePattern', e.target.value)}
                  placeholder="*.xlsx"
                  className="input"
                />
              </div>
            )}
          </div>

          {(form.sourceFormat === 'json' || form.sourceFormat === 'zip') && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('import.json_array_path')}</label>
              <input
                value={form.jsonArrayPath || ''}
                onChange={e => setField('jsonArrayPath', e.target.value)}
                placeholder="clusters.*.group_ax.*.brand.*"
                className="input font-mono text-xs"
              />
              <p className="text-xs text-slate-400 mt-1">{t('import.json_array_path_hint')}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('import.mappings')}</label>
              <div className="flex items-center gap-2">
                {editingId && (
                  <>
                    <input
                      ref={sampleFileRef}
                      type="file"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file || !editingId) return
                        setLoadingColumns(true)
                        try {
                          const res = await importApi.preview(editingId, file)
                          setPreviewColumns(res.columns)
                          toast.success(t('import.columns_discovered', { count: res.columns.length }))
                        } catch (err) {
                          toast.error(extractError(err, t('common.failed_to_load')), { duration: 6000 })
                        } finally {
                          setLoadingColumns(false)
                          e.target.value = ''
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => sampleFileRef.current?.click()}
                      disabled={loadingColumns}
                      className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                      title={t('import.discover_columns_hint')}
                    >
                      <Eye className="w-3 h-3" />
                      {loadingColumns ? t('common.loading') : t('import.discover_columns')}
                    </button>
                  </>
                )}
                <button onClick={addMapping} className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> {t('import.add_mapping')}
                </button>
              </div>
            </div>
            {previewColumns.length > 0 && (
              <div className="mb-2 p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('import.available_columns')}:</p>
                <div className="flex flex-wrap gap-1">
                  {previewColumns.map(col => (
                    <span key={col} className="inline-block px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <datalist id="import-source-columns">
              {previewColumns.map(col => <option key={col} value={col} />)}
            </datalist>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-1 text-xs text-slate-500 dark:text-slate-400 px-1">
                <span className="col-span-2">{t('import.mapping.source_column')}</span>
                <span className="col-span-2">{t('import.mapping.const_value')}</span>
                <span className="col-span-2">{t('import.mapping.target_column')}</span>
                <span className="col-span-2">{t('import.mapping.data_type')}</span>
                <span className="col-span-2">{t('import.mapping.date_format')}</span>
                <span className="col-span-1 text-center">{t('import.mapping.nullable')}</span>
                <span className="col-span-1" />
              </div>
              {form.mappings.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                  <input list="import-source-columns" value={m.sourceColumn || ''} onChange={e => setMapping(idx, { sourceColumn: e.target.value })} className="input py-1 text-xs col-span-2" placeholder={t('import.mapping.source_column_hint')} />
                  <input value={m.constValue || ''} onChange={e => setMapping(idx, { constValue: e.target.value })} className="input py-1 text-xs col-span-2" placeholder="{today}" />
                  <input value={m.targetColumn} onChange={e => setMapping(idx, { targetColumn: e.target.value })} className="input py-1 text-xs col-span-2" />
                  <select value={m.dataType} onChange={e => setMapping(idx, { dataType: e.target.value as ImportSourceMappingForm['dataType'] })} className="input py-1 text-xs col-span-2">
                    {DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                  </select>
                  <input
                    value={m.dateFormat || ''}
                    onChange={e => setMapping(idx, { dateFormat: e.target.value })}
                    placeholder={m.dataType === 'date' || m.dataType === 'datetime' ? 'yyyy-MM-dd' : ''}
                    disabled={m.dataType !== 'date' && m.dataType !== 'datetime'}
                    className="input py-1 text-xs col-span-2 disabled:opacity-40"
                  />
                  <div className="col-span-1 flex justify-center">
                    <input type="checkbox" checked={m.nullable} onChange={e => setMapping(idx, { nullable: e.target.checked })} className="w-4 h-4" />
                  </div>
                  <button onClick={() => removeMapping(idx)} className="col-span-1 btn-ghost p-1 text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.datasourceId || !form.targetTable}
            className="btn-primary"
          >
            {saving ? t('common.saving') : editingId ? t('common.save') : t('common.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Upload Card ----

interface UploadCardProps {
  source: ImportSource
}

function UploadCard({ source }: UploadCardProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [result, setResult] = useState<ImportUploadResult | null>(null)
  const [errors, setErrors] = useState<ImportErrorDetail[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const handlePreview = async () => {
    if (!file) return
    setPreviewing(true)
    setPreview(null)
    try {
      const res = await importApi.preview(source.id, file)
      setPreview(res)
    } catch (err) {
      toast.error(extractError(err, t('common.failed_to_load')), { duration: 6000 })
    } finally {
      setPreviewing(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setResult(null)
    setErrors([])
    try {
      const res = await importApi.upload(source.id, file)
      setResult(res)
      if (res.status === 'success') {
        toast.success(t('import.upload_success'))
      } else {
        toast.error(t('import.upload_error'))
        setErrors(res.errors.slice(0, 10))
      }
    } catch (err) {
      toast.error(extractError(err, t('common.operation_failed')), { duration: 6000 })
    } finally {
      setImporting(false)
    }
  }

  const formatAccept: Record<string, string> = {
    xlsx: '.xlsx', csv: '.csv', tsv: '.tsv', json: '.json', zip: '.zip',
  }
  const accept = formatAccept[source.sourceFormat] ?? '.xlsx'

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 dark:text-white truncate">{source.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {source.targetSchema}.{source.targetTable} &middot; {source.sourceFormat.toUpperCase()} &middot; {source.loadMode}
            </p>
          </div>
        </div>
        <button onClick={() => fileRef.current?.click()} className="btn-primary flex-shrink-0 flex items-center gap-2">
          <Upload className="w-4 h-4" /> {t('import.upload_file')}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          setFile(e.target.files?.[0] || null)
          setPreview(null)
          setResult(null)
          setErrors([])
        }}
      />

      {file && (
        <div className="mt-3 pt-3 border-t border-surface-200 dark:border-dark-surface-100">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 mb-3">
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
            <span className="truncate">{file.name}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handlePreview} disabled={previewing} className="btn-secondary text-xs flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {previewing ? t('import.previewing') : t('import.preview')}
            </button>
            <button onClick={handleImport} disabled={importing} className="btn-primary text-xs flex items-center gap-1">
              <Upload className="w-3 h-3" />
              {importing ? t('import.importing') : t('import.import')}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="mt-3 pt-3 border-t border-surface-200 dark:border-dark-surface-100">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{t('import.preview_title')}</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  {preview.columns.map(c => (
                    <th key={c} className="text-left px-2 py-1 bg-surface-50 dark:bg-dark-surface-100 font-medium text-slate-600 dark:text-slate-400 border border-surface-200 dark:border-dark-surface-100">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 border border-surface-200 dark:border-dark-surface-100 text-slate-700 dark:text-slate-300">{String(cell ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-3 pt-3 border-t border-surface-200 dark:border-dark-surface-100">
          <div className="flex items-center gap-2 mb-1">
            {result.status === 'success'
              ? <CheckCircle className="w-4 h-4 text-emerald-500" />
              : <XCircle className="w-4 h-4 text-red-500" />}
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('import.rows_imported', { count: result.rowsImported })}
              {' | '}
              {t('import.rows_failed', { count: result.rowsFailed })}
              {' | '}
              {t('import.rows_total', { count: result.rowsTotal })}
            </span>
          </div>
          {errors.length > 0 && (
            <div>
              <button onClick={() => setShowErrors(s => !s)} className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <ChevronDown className={`w-3 h-3 transition-transform ${showErrors ? 'rotate-180' : ''}`} />
                {errors.length} errors
              </button>
              {showErrors && (
                <div className="mt-2 space-y-1">
                  {errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
                      Row {err.rowNumber}{err.columnName ? ` / ${err.columnName}` : ''}: {err.errorMessage}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- History Tab ----

function HistoryTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [logErrors, setLogErrors] = useState<Record<number, ImportErrorDetail[]>>({})

  useEffect(() => {
    importApi.listLogs()
      .then(setLogs)
      .catch(() => toast.error(t('common.failed_to_load')))
      .finally(() => setLoading(false))
  }, [])

  const handleExpand = async (log: ImportLog) => {
    if (log.status !== 'error') return
    if (expandedId === log.id) { setExpandedId(null); return }
    setExpandedId(log.id)
    if (!logErrors[log.id]) {
      try {
        const errs = await importApi.getLogErrors(log.id)
        setLogErrors(m => ({ ...m, [log.id]: errs }))
      } catch {
        toast.error(t('common.failed_to_load'))
      }
    }
  }

  if (loading) return <LoadingSpinner />
  if (logs.length === 0) return <EmptyState icon={<Clock className="w-12 h-12" />} title={t('import.no_history')} />

  const colSpan = canManage ? 8 : 7

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: '700px' }}>
        <thead>
          <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-surface-200 dark:border-dark-surface-100">
            <th className="pb-2 pr-4 font-medium overflow-hidden" style={{ resize: 'horizontal', width: '22%', minWidth: '120px' }}>{t('import.source_name')}</th>
            <th className="pb-2 pr-4 font-medium overflow-hidden" style={{ resize: 'horizontal', width: '18%', minWidth: '100px' }}>{t('import.history.file')}</th>
            {canManage && <th className="pb-2 pr-4 font-medium overflow-hidden" style={{ resize: 'horizontal', width: '10%', minWidth: '80px' }}>{t('import.history.user')}</th>}
            <th className="pb-2 pr-4 font-medium overflow-hidden" style={{ resize: 'horizontal', width: '15%', minWidth: '130px' }}>{t('import.history.date')}</th>
            <th className="pb-2 pr-3 text-right font-medium" style={{ width: '8%', minWidth: '50px' }}>{t('import.rows_total_short')}</th>
            <th className="pb-2 pr-3 text-right font-medium" style={{ width: '8%', minWidth: '50px' }}>{t('import.rows_imported_short')}</th>
            <th className="pb-2 pr-3 text-right font-medium" style={{ width: '8%', minWidth: '50px' }}>{t('import.rows_failed_short')}</th>
            <th className="pb-2 font-medium" style={{ width: '11%', minWidth: '80px' }}>{t('common.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-dark-surface-100">
          {logs.map(log => (
            <>
              <tr
                key={log.id}
                className={log.status === 'error' ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10' : ''}
                onClick={() => handleExpand(log)}
              >
                <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-300 truncate" title={log.sourceName}>{log.sourceName}</td>
                <td className="py-2 pr-4 text-slate-500 dark:text-slate-400 truncate" title={log.filename}>{log.filename}</td>
                {canManage && (
                  <td className="py-2 pr-4 text-slate-500 dark:text-slate-400 truncate" title={log.uploadedBy ?? '-'}>{log.uploadedBy ?? '-'}</td>
                )}
                <td className="py-2 pr-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(log.uploadedAt).toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-slate-500 dark:text-slate-400">{log.rowsTotal ?? '-'}</td>
                <td className="py-2 pr-3 text-right text-emerald-600 dark:text-emerald-400">{log.rowsImported ?? '-'}</td>
                <td className="py-2 pr-3 text-right text-red-500">{log.rowsFailed ?? '-'}</td>
                <td className="py-2">{statusBadge(log.status, t)}</td>
              </tr>
              {expandedId === log.id && (
                <tr key={`${log.id}-errors`}>
                  <td colSpan={colSpan} className="pb-3 pt-1 px-4 bg-red-50 dark:bg-red-900/10">
                    <div className="space-y-1">
                      {log.errorDetail && (
                        <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                          {log.errorDetail}
                        </div>
                      )}
                      {logErrors[log.id]?.slice(0, 20).map((err, i) => (
                        <div key={i} className="text-xs text-red-600 dark:text-red-400">
                          {t('import.history.row')} {err.rowNumber}{err.columnName ? ` / ${err.columnName}` : ''}: {err.errorMessage}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- API Keys Tab ----

function ApiKeysTab() {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)

  const load = () => {
    apiKeyApi.list()
      .then(setKeys)
      .catch((err) => toast.error(extractError(err, t('common.failed_to_load'))))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const result = await apiKeyApi.create(newName.trim(), newExpiry || undefined)
      setCreated(result)
      setNewName('')
      setNewExpiry('')
      load()
    } catch (err) {
      toast.error(extractError(err, t('common.operation_failed')))
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: number) => {
    if (!confirm(t('import.apikeys.revoke_confirm'))) return
    try {
      await apiKeyApi.revoke(id)
      setKeys(k => k.filter(x => x.id !== id))
      toast.success(t('import.apikeys.revoked'))
    } catch (err) {
      toast.error(extractError(err, t('common.failed_to_delete')))
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {created && (
        <div className="card p-4 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">{t('import.apikeys.created_notice')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-white dark:bg-dark-surface-100 border border-surface-200 dark:border-dark-surface-100 rounded px-3 py-2 select-all break-all">
              {created.key}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(created.key); toast.success(t('common.copied')) }}
              className="btn-secondary text-xs flex-shrink-0"
            >
              {t('common.copy')}
            </button>
          </div>
          <button onClick={() => setCreated(null)} className="mt-2 text-xs text-slate-500 hover:text-slate-700">
            {t('import.apikeys.dismiss')}
          </button>
        </div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('import.apikeys.new')}</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t('import.apikeys.name_placeholder')}
            className="input flex-1 min-w-40"
          />
          <input
            type="date"
            value={newExpiry}
            onChange={e => setNewExpiry(e.target.value)}
            title={t('import.apikeys.expires_hint')}
            className="input w-40"
          />
          <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary">
            {creating ? t('common.saving') : t('import.apikeys.generate')}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">{t('import.apikeys.expires_hint')}</p>
      </div>

      {keys.length === 0 ? (
        <EmptyState icon={<Database className="w-12 h-12" />} title={t('import.apikeys.empty')} />
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="card p-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-800 dark:text-white">{k.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {k.keyPrefix}...
                  {k.expiresAt && <span className="ml-3 not-italic">{t('import.apikeys.expires')}: {k.expiresAt.slice(0, 10)}</span>}
                  {k.lastUsedAt && <span className="ml-3 not-italic">{t('import.apikeys.last_used')}: {k.lastUsedAt.slice(0, 10)}</span>}
                  {!k.lastUsedAt && <span className="ml-3 not-italic text-slate-400">{t('import.apikeys.never_used')}</span>}
                </p>
              </div>
              <button onClick={() => handleRevoke(k.id)} className="btn-ghost p-2 text-red-500 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4 bg-slate-50 dark:bg-dark-surface-50">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{t('import.apikeys.usage_title')}</p>
        <code className="block text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          {`curl -X POST https://datorio.rbtdigitalmobile.ru/api/import/sources/{source_id}/upload \\
  -H "Authorization: Bearer dat_YOUR_API_KEY" \\
  -F "file=@/path/to/file.zip"`}
        </code>
      </div>
    </div>
  )
}

// ---- Main Page ----

export default function ImportPage() {
  const { t } = useTranslation()
  const permissions = useAuthStore(s => s.user?.permissions ?? [])
  const canManage = permissions.includes('IMPORT_MANAGE')

  const [activeTab, setActiveTab] = useState<Tab>(canManage ? 'sources' : 'upload')
  const [sources, setSources] = useState<ImportSource[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSource, setEditingSource] = useState<ImportSource | null>(null)

  const loadSources = () => {
    setLoading(true)
    importApi.listSources()
      .then(setSources)
      .catch((err) => toast.error(extractError(err, t('common.failed_to_load')), { duration: 6000 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSources()
    datasourceApi.list().then(setDatasources).catch(() => {})
  }, [])

  const handleExport = (src: ImportSource) => {
    const blob = new Blob([JSON.stringify(src, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import-source-${src.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('import.delete_confirm'))) return
    try {
      await importApi.deleteSource(id)
      toast.success(t('common.deleted'))
      loadSources()
    } catch {
      toast.error(t('common.failed_to_delete'))
    }
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'sources', label: t('import.sources_tab'), show: canManage },
    { key: 'upload', label: t('import.upload_tab'), show: true },
    { key: 'history', label: t('import.history_tab'), show: true },
    { key: 'apikeys', label: t('import.apikeys_tab'), show: canManage },
  ]

  return (
    <div className={`mx-auto ${activeTab === 'history' ? 'max-w-full px-6' : 'max-w-[1000px]'}`}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('import.title')}</h1>
        {activeTab === 'sources' && canManage && (
          <button onClick={() => { setEditingSource(null); setShowForm(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('import.new_source')}
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-surface-200 dark:border-dark-surface-100">
        {tabs.filter(tab => tab.show).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sources' && canManage && (
        loading ? <LoadingSpinner /> : sources.length === 0 ? (
          <EmptyState icon={<Database className="w-12 h-12" />} title={t('import.no_sources')} />
        ) : (
          <div className="space-y-3">
            {sources.map(src => (
              <div key={src.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-white truncate">{src.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {src.datasourceName} &middot; {src.targetSchema}.{src.targetTable} &middot; {src.sourceFormat.toUpperCase()} &middot; {t(`import.load_mode.${src.loadMode}`)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleExport(src)} className="btn-ghost p-2" title={t('import.export')}>
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditingSource(src); setShowForm(true) }} className="btn-ghost p-2">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(src.id)} className="btn-ghost p-2 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'upload' && (
        loading ? <LoadingSpinner /> : sources.length === 0 ? (
          <EmptyState icon={<Upload className="w-12 h-12" />} title={t('import.no_sources')} />
        ) : (
          <div className="space-y-4">
            {sources.map(src => <UploadCard key={src.id} source={src} />)}
          </div>
        )
      )}

      {activeTab === 'history' && <HistoryTab canManage={canManage} />}
      {activeTab === 'apikeys' && canManage && <ApiKeysTab />}

      {showForm && (
        <SourceFormModal
          datasources={datasources}
          initial={editingSource
            ? {
                name: editingSource.name,
                description: editingSource.description,
                datasourceId: editingSource.datasourceId,
                sourceFormat: editingSource.sourceFormat,
                sheetName: editingSource.sheetName,
                headerRow: editingSource.headerRow,
                skipRows: editingSource.skipRows,
                targetSchema: editingSource.targetSchema,
                targetTable: editingSource.targetTable,
                loadMode: editingSource.loadMode,
                keyColumns: editingSource.keyColumns,
                filenamePattern: editingSource.filenamePattern,
                fileEncoding: editingSource.fileEncoding,
                jsonArrayPath: editingSource.jsonArrayPath,
                mappings: editingSource.mappings.map(m => ({
                  sourceColumn: m.sourceColumn,
                  targetColumn: m.targetColumn,
                  dataType: m.dataType,
                  nullable: m.nullable,
                  dateFormat: m.dateFormat,
                  constValue: m.constValue,
                })),
              }
            : emptyForm()
          }
          editingId={editingSource?.id ?? null}
          onClose={() => { setShowForm(false); setEditingSource(null) }}
          onSaved={loadSources}
        />
      )}
    </div>
  )
}
