import { useDesignerStore } from '@/store/useDesignerStore'
import { Plus, Trash2 } from 'lucide-react'

const PARAM_TYPES = ['STRING', 'NUMBER', 'DATE', 'DATE_RANGE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN']

export default function ParameterDesigner() {
  const parameters = useDesignerStore(s => s.parameters)
  const setParameters = useDesignerStore(s => s.setParameters)

  const addParam = () => {
    setParameters([...parameters, {
      name: `param${parameters.length + 1}`,
      label: '',
      paramType: 'STRING',
      defaultValue: '',
      isRequired: false,
      sortOrder: parameters.length,
    }])
  }

  const updateParam = (index: number, updates: Partial<typeof parameters[0]>) => {
    const updated = parameters.map((p, i) => i === index ? { ...p, ...updates } : p)
    setParameters(updated)
  }

  const removeParam = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Parameters ({parameters.length})
        </label>
        <button onClick={addParam} className="btn-ghost text-xs p-1">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {parameters.length === 0 ? (
        <p className="text-xs text-slate-400">No parameters defined</p>
      ) : (
        <div className="space-y-2">
          {parameters.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-white dark:bg-dark-surface-50 rounded-lg p-2 border border-surface-200 dark:border-dark-surface-100">
              <input
                value={p.name} onChange={e => updateParam(i, { name: e.target.value })}
                className="input text-xs flex-1 py-1" placeholder="name"
              />
              <input
                value={p.label} onChange={e => updateParam(i, { label: e.target.value })}
                className="input text-xs flex-1 py-1" placeholder="label"
              />
              <select
                value={p.paramType} onChange={e => updateParam(i, { paramType: e.target.value })}
                className="input text-xs w-28 py-1"
              >
                {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                value={p.defaultValue} onChange={e => updateParam(i, { defaultValue: e.target.value })}
                className="input text-xs w-24 py-1" placeholder="default"
              />
              <label className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                <input
                  type="checkbox" checked={p.isRequired}
                  onChange={e => updateParam(i, { isRequired: e.target.checked })}
                />
                Req
              </label>
              <button onClick={() => removeParam(i)} className="btn-ghost p-1 text-red-500 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
