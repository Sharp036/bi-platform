import { useTranslation } from 'react-i18next'
import { useDesignerStore } from '@/store/useDesignerStore'
import { Plus, Trash2 } from 'lucide-react'

const PARAM_TYPES = ['STRING', 'NUMBER', 'DATE', 'DATE_RANGE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN']
const DATE_DEFAULTS = [
  { value: '', label: 'Manual' },
  { value: '__today__', label: 'Today' },
  { value: '__start_of_year__', label: 'Start of Year' },
  { value: '__start_of_month__', label: 'Start of Month' },
]

export default function ParameterDesigner() {
  const { t } = useTranslation()
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
          {t('designer.parameters', { count: parameters.length })}
        </label>
        <button onClick={addParam} className="btn-ghost text-xs p-1">
          <Plus className="w-3.5 h-3.5" /> {t('designer.add')}
        </button>
      </div>

      {parameters.length === 0 ? (
        <p className="text-xs text-slate-400">{t('designer.no_parameters')}</p>
      ) : (
        <div className="space-y-2">
          {parameters.map((p, i) => (
            <div key={i} className="bg-white dark:bg-dark-surface-50 rounded-lg p-2 border border-surface-200 dark:border-dark-surface-100 space-y-2">
              <div className="grid grid-cols-1 gap-2">
                <input
                  value={p.name} onChange={e => updateParam(i, { name: e.target.value })}
                  className="input text-xs py-1" placeholder={t('designer.param_name')}
                />
                <input
                  value={p.label} onChange={e => updateParam(i, { label: e.target.value })}
                  className="input text-xs py-1" placeholder={t('designer.param_label')}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <select
                  value={p.paramType} onChange={e => updateParam(i, { paramType: e.target.value })}
                  className="input text-xs py-1"
                >
                  {PARAM_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                </select>
                <input
                  value={p.defaultValue} onChange={e => updateParam(i, { defaultValue: e.target.value })}
                  className="input text-xs py-1" placeholder={t('designer.param_default')}
                />
                {(p.paramType === 'DATE' || p.paramType === 'DATE_RANGE') && (
                  <select
                    value={DATE_DEFAULTS.some(d => d.value === p.defaultValue) ? p.defaultValue : ''}
                    onChange={e => updateParam(i, { defaultValue: e.target.value })}
                    className="input text-xs py-1"
                  >
                    {DATE_DEFAULTS.map(d => <option key={d.value || 'manual'} value={d.value}>{d.label}</option>)}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox" checked={p.isRequired}
                    onChange={e => updateParam(i, { isRequired: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  {t('designer.param_required')}
                </label>
                <button onClick={() => removeParam(i)} className="btn-ghost p-1 text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
