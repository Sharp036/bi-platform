import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { modelingApi, type DataModelItem } from '@/api/modeling'
import { datasourceApi } from '@/api/datasources'
import type { DataSource } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Boxes, Plus, Trash2, X, Pencil, Globe, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ModelListPage() {
  const navigate = useNavigate()
  const [models, setModels] = useState<DataModelItem[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dsId, setDsId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      modelingApi.listModels().then(setModels),
      datasourceApi.list().then(d => { setDatasources(d); if (!dsId && d.length > 0) setDsId(d[0].id) }),
    ]).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (!name.trim() || !dsId) return
    setSaving(true)
    try {
      const model = await modelingApi.createModel({ name: name.trim(), description: description.trim() || undefined, datasourceId: dsId })
      toast.success('Model created')
      setShowForm(false)
      setName(''); setDescription('')
      navigate(`/models/${model.id}`)
    } catch { toast.error('Failed to create') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this data model and all its tables, fields, and relationships?')) return
    try { await modelingApi.deleteModel(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const handleTogglePublish = async (m: DataModelItem) => {
    try {
      await modelingApi.updateModel(m.id, { isPublished: !m.isPublished })
      toast.success(m.isPublished ? 'Unpublished' : 'Published')
      load()
    } catch { toast.error('Failed to update') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Data Models</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Model</button>
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">New Data Model</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Model name" className="input" autoFocus />
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className="input" rows={2} />
              <select value={dsId || ''} onChange={e => setDsId(Number(e.target.value))} className="input">
                {datasources.map(ds => <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !name.trim() || !dsId} className="btn-primary">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {models.length === 0 ? (
        <EmptyState icon={<Boxes className="w-12 h-12" />} title="No data models" description="Create a semantic model to explore your data without writing SQL" />
      ) : (
        <div className="space-y-3">
          {models.map(m => (
            <div key={m.id} className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                 onClick={() => navigate(`/models/${m.id}`)}>
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <Boxes className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 dark:text-white truncate">{m.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {m.datasourceName} · {m.tableCount} tables · {m.fieldCount} fields · {m.relationshipCount} joins
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => handleTogglePublish(m)}
                        className="btn-ghost p-2 text-xs" title={m.isPublished ? 'Published' : 'Draft'}>
                  {m.isPublished
                    ? <Globe className="w-4 h-4 text-emerald-500" />
                    : <Lock className="w-4 h-4 text-slate-400" />}
                </button>
                <button onClick={() => navigate(`/models/${m.id}`)} className="btn-ghost p-2 text-xs"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(m.id)} className="btn-ghost p-2 text-xs text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
