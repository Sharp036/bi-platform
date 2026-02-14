import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { vizApi, AnnotationItem } from '@/api/visualization'
import { Plus, Trash2, TrendingUp, Minus, AlignHorizontalSpaceAround, Type } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  widgetId: number
}

const TYPES = [
  { value: 'LINE', labelKey: 'interactive.annotation.reference_line', icon: Minus },
  { value: 'BAND', labelKey: 'interactive.annotation.reference_band', icon: AlignHorizontalSpaceAround },
  { value: 'TREND', labelKey: 'interactive.annotation.trend_line', icon: TrendingUp },
  { value: 'TEXT', labelKey: 'interactive.annotation.text_mark', icon: Type },
]

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#64748b']

export default function AnnotationEditor({ widgetId }: Props) {
  const { t } = useTranslation()
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState('LINE')
  const [newAxis, setNewAxis] = useState('y')
  const [newValue, setNewValue] = useState('')
  const [newValueEnd, setNewValueEnd] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#ef4444')

  const load = () => {
    vizApi.getAnnotations(widgetId).then(setAnnotations).catch(() => {})
  }

  useEffect(load, [widgetId])

  const add = async () => {
    const val = parseFloat(newValue)
    if (isNaN(val) && newType !== 'TREND') {
      toast.error(t('interactive.annotation.value_required')); return
    }
    try {
      await vizApi.createAnnotation({
        widgetId,
        annotationType: newType,
        axis: newAxis,
        value: isNaN(val) ? undefined : val,
        valueEnd: newType === 'BAND' ? parseFloat(newValueEnd) || undefined : undefined,
        label: newLabel || undefined,
        color: newColor,
      })
      setShowAdd(false)
      setNewValue(''); setNewValueEnd(''); setNewLabel('')
      load()
      toast.success(t('interactive.annotation.added'))
    } catch {
      toast.error(t('interactive.annotation.failed_add'))
    }
  }

  const remove = async (id: number) => {
    try {
      await vizApi.deleteAnnotation(id)
      load()
    } catch {
      toast.error(t('interactive.annotation.failed_remove'))
    }
  }

  const toggle = async (ann: AnnotationItem) => {
    try {
      await vizApi.updateAnnotation(ann.id, {
        ...ann,
        isVisible: !ann.isVisible,
      })
      load()
    } catch {
      toast.error(t('interactive.annotation.failed_update'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('interactive.annotation.title')}
        </h3>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-secondary text-xs">
          <Plus className="w-3.5 h-3.5" /> {t('common.add')}
        </button>
      </div>

      {showAdd && (
        <div className="card p-3 space-y-2">
          <div className="flex gap-2">
            <select value={newType} onChange={e => setNewType(e.target.value)} className="input text-xs py-1 w-40">
              {TYPES.map(tp => <option key={tp.value} value={tp.value}>{t(tp.labelKey)}</option>)}
            </select>
            <select value={newAxis} onChange={e => setNewAxis(e.target.value)} className="input text-xs py-1 w-20">
              <option value="y">{t('interactive.annotation.y_axis')}</option>
              <option value="x">{t('interactive.annotation.x_axis')}</option>
            </select>
          </div>

          {newType !== 'TREND' && (
            <div className="flex gap-2">
              <input type="number" value={newValue} onChange={e => setNewValue(e.target.value)}
                placeholder={t('interactive.annotation.value_placeholder')} className="input text-xs py-1 flex-1" />
              {newType === 'BAND' && (
                <input type="number" value={newValueEnd} onChange={e => setNewValueEnd(e.target.value)}
                  placeholder={t('interactive.annotation.end_value')} className="input text-xs py-1 flex-1" />
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder={t('interactive.annotation.label_placeholder')} className="input text-xs py-1 flex-1" />
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={clsx('w-5 h-5 rounded-full border-2 transition-all',
                    newColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={add} className="btn-primary text-xs">{t('common.create')}</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* Existing annotations */}
      <div className="space-y-1">
        {annotations.length === 0 && !showAdd && (
          <p className="text-xs text-slate-400">{t('interactive.annotation.no_annotations')}</p>
        )}
        {annotations.map(ann => {
          const TypeDef = TYPES.find(t => t.value === ann.annotationType)
          const Icon = TypeDef?.icon || Minus
          return (
            <div key={ann.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 dark:hover:bg-dark-surface-100">
              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ann.color || '#64748b' }} />
              <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">
                {ann.label || `${ann.annotationType} @ ${ann.value}`}
              </span>
              <span className="text-[10px] text-slate-400">{ann.axis}-axis</span>
              <button onClick={() => toggle(ann)}
                className={clsx('text-[10px] px-1.5 py-0.5 rounded', ann.isVisible
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                )}>
                {ann.isVisible ? 'on' : 'off'}
              </button>
              <button onClick={() => remove(ann.id)}
                className="p-0.5 text-slate-400 hover:text-red-500">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
