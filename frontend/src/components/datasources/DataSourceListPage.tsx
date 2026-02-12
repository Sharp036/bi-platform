import { useEffect, useState } from 'react'
import { datasourceApi } from '@/api/datasources'
import type { DataSource, DataSourceForm } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Database, Plus, Trash2, Zap, X } from 'lucide-react'
import toast from 'react-hot-toast'

const emptyForm: DataSourceForm = {
  name: '', type: 'POSTGRESQL', host: 'localhost', port: 5432,
  databaseName: '', username: '', password: '',
}

export default function DataSourceListPage() {
  const [sources, setSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<DataSourceForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    datasourceApi.list().then(setSources).catch(() => toast.error('Failed to load')).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    setSaving(true)
    try {
      await datasourceApi.create(form)
      toast.success('Data source created')
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch { toast.error('Failed to create') }
    finally { setSaving(false) }
  }

  const handleTest = async (id: number) => {
    try {
      const res = await datasourceApi.test(id)
      if (res.success) toast.success('Connection successful')
      else toast.error(`Connection failed: ${res.message}`)
    } catch { toast.error('Connection test failed') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this data source?')) return
    try { await datasourceApi.delete(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Data Sources</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Source</button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">New Data Source</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" className="input" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'POSTGRESQL' | 'CLICKHOUSE', port: e.target.value === 'CLICKHOUSE' ? 8123 : 5432 })} className="input">
                <option value="POSTGRESQL">PostgreSQL</option>
                <option value="CLICKHOUSE">ClickHouse</option>
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="Host" className="input col-span-2" />
                <input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })} placeholder="Port" className="input" />
              </div>
              <input value={form.databaseName} onChange={e => setForm({ ...form, databaseName: e.target.value })} placeholder="Database name" className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Username" className="input" />
                <input type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password" className="input" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name || !form.databaseName} className="btn-primary">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : sources.length === 0 ? (
        <EmptyState icon={<Database className="w-12 h-12" />} title="No data sources" description="Connect your first database" />
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
