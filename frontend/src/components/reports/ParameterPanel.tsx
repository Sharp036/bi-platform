import { useState } from 'react'
import type { ReportParameter } from '@/types'
import { Play } from 'lucide-react'

interface Props {
  parameters: ReportParameter[]
  onApply: (values: Record<string, unknown>) => void
  loading?: boolean
}

export default function ParameterPanel({ parameters, onApply, loading }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    parameters.forEach(p => {
      if (p.defaultValue) init[p.name] = p.defaultValue
    })
    return init
  })

  if (parameters.length === 0) return null

  const handleApply = () => {
    const typed: Record<string, unknown> = {}
    parameters.forEach(p => {
      const v = values[p.name]
      if (v === undefined || v === '') return
      switch (p.paramType) {
        case 'NUMBER': typed[p.name] = Number(v); break
        case 'BOOLEAN': typed[p.name] = v === 'true'; break
        default: typed[p.name] = v
      }
    })
    onApply(typed)
  }

  return (
    <div className="card p-4 mb-4">
      <div className="flex flex-wrap items-end gap-4">
        {parameters.map((p) => (
          <div key={p.name} className="flex-1 min-w-[180px] max-w-[260px]">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {p.label || p.name}
              {p.isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {p.paramType === 'DATE' || p.paramType === 'DATE_RANGE' ? (
              <input
                type="date"
                value={values[p.name] || ''}
                onChange={e => setValues({ ...values, [p.name]: e.target.value })}
                className="input text-sm"
              />
            ) : p.paramType === 'BOOLEAN' ? (
              <select
                value={values[p.name] || ''}
                onChange={e => setValues({ ...values, [p.name]: e.target.value })}
                className="input text-sm"
              >
                <option value="">—</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : p.paramType === 'SELECT' ? (
              <select
                value={values[p.name] || ''}
                onChange={e => setValues({ ...values, [p.name]: e.target.value })}
                className="input text-sm"
              >
                <option value="">All</option>
                {(p.config?.options as string[] || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={p.paramType === 'NUMBER' ? 'number' : 'text'}
                value={values[p.name] || ''}
                onChange={e => setValues({ ...values, [p.name]: e.target.value })}
                placeholder={p.defaultValue || ''}
                className="input text-sm"
              />
            )}
          </div>
        ))}

        <button onClick={handleApply} disabled={loading} className="btn-primary h-[38px]">
          <Play className="w-4 h-4" />
          Apply
        </button>
      </div>
    </div>
  )
}
