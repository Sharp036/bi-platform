import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { datasourceApi } from '@/api/datasources'
import type { DataSource, DataSourceForm } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Database, Plus, Trash2, Zap, X, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

const emptyForm: DataSourceForm = {
  name: '', type: 'POSTGRESQL', host: 'localhost', port: 5432,
  databaseName: '', username: '', password: '',
}

export default function DataSourceListPage() {
  const { t } = useTranslation()
  const [sources, setSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<DataSourceForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    datasourceApi.list().then(setSources).catch(() => toast.error(t('common.failed_to_load'))).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    setSaving(true)
    try {
      await datasourceApi.create(form)
      toast.success(t('datasources.created'))
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch { toast.error(t('common.failed_to_create')) }
    finally { setSaving(false) }
  }

  const handleEdit = (ds: DataSource) => {
    setEditingId(ds.id)
    setForm({
      name: ds.name,
      type: ds.type,
      host: ds.host,
      port: ds.port,
      databaseName: ds.databaseName,
      username: ds.username || '',
      password: '',
    })
    setShowForm(true)
  }

  const handleUpdate = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await datasourceApi.update(editingId, form)
      toast.success(t('datasources.updated'))
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      load()
    } catch { toast.error(t('common.failed_to_update')) }
    finally { setSaving(false) }
  }

  const handleTest = async (id: number) => {
    try {
      const res = await datasourceApi.test(id)
      if (res.success) toast.success(t('datasources.connection_success'))
      else toast.error(t('datasources.connection_failed', { message: res.message }))
    } catch { toast.error(t('datasources.connection_test_failed')) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('datasources.delete_confirm'))) return
    try { await datasourceApi.delete(id); toast.success(t('common.deleted')); load() }
    catch { toast.error(t('common.failed_to_delete')) }
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('datasources.title')}</h1>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true) }} className="btn-primary"><Plus className="w-4 h-4" /> {t('datasources.add_source')}</button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{editingId ? t('datasources.edit_datasource') : t('datasources.new_datasource')}</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('datasources.name')} className="input" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'POSTGRESQL' | 'CLICKHOUSE', port: e.target.value === 'CLICKHOUSE' ? 8123 : 5432 })} className="input">
                <option value="POSTGRESQL">PostgreSQL</option>
                <option value="CLICKHOUSE">ClickHouse</option>
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder={t('datasources.host')} className="input col-span-2" />
                <input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })} placeholder={t('datasources.port')} className="input" />
              </div>
              <input value={form.databaseName} onChange={e => setForm({ ...form, databaseName: e.target.value })} placeholder={t('datasources.database_name')} className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} placeholder={t('datasources.username')} className="input" />
                <input type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={t('datasources.password')} className="input" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm) }} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={editingId ? handleUpdate : handleCreate} disabled={saving || !form.name || (form.type !== 'CLICKHOUSE' && !form.databaseName)} className="btn-primary">
                {saving ? t('common.saving') : editingId ? t('common.save') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : sources.length === 0 ? (
        <EmptyState icon={<Database className="w-12 h-12" />} title={t('datasources.no_datasources')} description={t('datasources.connect_first')} />
      ) : (
        <div className="space-y-3">
          {sources.map(ds => (
            <div key={ds.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 dark:text-white truncate">{ds.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ds.type} · {ds.host}:{ds.port}/{ds.databaseName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full mr-2 ${ds.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <button onClick={() => handleEdit(ds)} className="btn-ghost p-2 text-xs"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleTest(ds.id)} className="btn-ghost p-2 text-xs"><Zap className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(ds.id)} className="btn-ghost p-2 text-xs text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
