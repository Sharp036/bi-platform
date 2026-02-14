import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { controlsApi, ParameterControlConfig } from '@/api/controls'
import type { ReportParameter } from '@/types'
import { Settings, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  reportId: number
  parameters: ReportParameter[]
}

const CONTROL_TYPES = [
  { value: 'INPUT', labelKey: 'interactive.control.text_input' },
  { value: 'DROPDOWN', labelKey: 'interactive.control.dropdown' },
  { value: 'SLIDER', labelKey: 'interactive.control.slider' },
  { value: 'RADIO', labelKey: 'interactive.control.radio' },
  { value: 'DATE_PICKER', labelKey: 'interactive.control.date_picker' },
  { value: 'MULTI_CHECKBOX', labelKey: 'interactive.control.multi_checkbox' },
]

export default function ParameterControlConfigPanel({ reportId, parameters }: Props) {
  const { t } = useTranslation()
  const [controls, setControls] = useState<ParameterControlConfig[]>([])

  const load = () => {
    controlsApi.getParameterControls(reportId).then(setControls).catch(() => {})
  }

  useEffect(load, [reportId])

  const save = async (paramName: string, update: Partial<ParameterControlConfig>) => {
    const existing = controls.find(c => c.parameterName === paramName)
    try {
      await controlsApi.saveParameterControl({
        reportId,
        parameterName: paramName,
        controlType: update.controlType ?? existing?.controlType ?? 'INPUT',
        datasourceId: update.datasourceId ?? existing?.datasourceId ?? undefined,
        optionsQuery: update.optionsQuery ?? existing?.optionsQuery ?? undefined,
        cascadeParent: update.cascadeParent ?? existing?.cascadeParent ?? undefined,
        cascadeField: update.cascadeField ?? existing?.cascadeField ?? undefined,
        sliderMin: update.sliderMin ?? existing?.sliderMin ?? undefined,
        sliderMax: update.sliderMax ?? existing?.sliderMax ?? undefined,
        sliderStep: update.sliderStep ?? existing?.sliderStep ?? undefined,
        sortOrder: update.sortOrder ?? existing?.sortOrder ?? 0,
      })
      load()
      toast.success(t('interactive.control.saved'))
    } catch {
      toast.error(t('interactive.control.failed_save'))
    }
  }

  const remove = async (paramName: string) => {
    try {
      await controlsApi.deleteParameterControl(reportId, paramName)
      load()
    } catch {
      toast.error(t('interactive.control.failed_remove'))
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
        <Settings className="w-4 h-4 text-brand-500" /> {t('interactive.parameter_controls')}
      </h3>

      <div className="space-y-3">
        {parameters.map(p => {
          const ctrl = controls.find(c => c.parameterName === p.name)
          return (
            <div key={p.name} className="card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {p.label || p.name}
                  <span className="text-xs text-slate-400 ml-2">({p.paramType})</span>
                </p>
                {ctrl && (
                  <button onClick={() => remove(p.name)}
                    className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.control_type')}</label>
                  <select
                    value={ctrl?.controlType || 'INPUT'}
                    onChange={e => save(p.name, { controlType: e.target.value })}
                    className="input text-xs py-1 w-36"
                  >
                    {CONTROL_TYPES.map(ct => (
                      <option key={ct.value} value={ct.value}>{t(ct.labelKey)}</option>
                    ))}
                  </select>
                </div>

                {(ctrl?.controlType === 'SLIDER') && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.min')}</label>
                      <input type="number" value={ctrl?.sliderMin ?? 0}
                        onChange={e => save(p.name, { sliderMin: Number(e.target.value) })}
                        className="input text-xs py-1 w-20" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.max')}</label>
                      <input type="number" value={ctrl?.sliderMax ?? 100}
                        onChange={e => save(p.name, { sliderMax: Number(e.target.value) })}
                        className="input text-xs py-1 w-20" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.step')}</label>
                      <input type="number" value={ctrl?.sliderStep ?? 1}
                        onChange={e => save(p.name, { sliderStep: Number(e.target.value) })}
                        className="input text-xs py-1 w-20" />
                    </div>
                  </>
                )}

                {(ctrl?.controlType === 'DROPDOWN' || ctrl?.controlType === 'RADIO' || ctrl?.controlType === 'MULTI_CHECKBOX') && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.options_sql')}</label>
                      <input value={ctrl?.optionsQuery || ''}
                        onChange={e => save(p.name, { optionsQuery: e.target.value })}
                        placeholder={t('interactive.control.sql_placeholder')}
                        className="input text-xs py-1 w-64" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">{t('interactive.control.cascade_parent')}</label>
                      <select value={ctrl?.cascadeParent || ''}
                        onChange={e => save(p.name, { cascadeParent: e.target.value || undefined })}
                        className="input text-xs py-1 w-36">
                        <option value="">{t('common.none')}</option>
                        {parameters.filter(pp => pp.name !== p.name).map(pp => (
                          <option key={pp.name} value={pp.name}>{pp.label || pp.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
