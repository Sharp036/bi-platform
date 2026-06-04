import { useTranslation } from 'react-i18next'
import type { DesignerWidget } from '@/store/useDesignerStore'
import { Field } from '@/components/designer/PropertyPanel'

// FILTER widget configuration: which column it filters, the control type, and
// an optional placeholder.
export default function FilterConfigOptions({ cc, update, availableCols }: {
  cc: Record<string, unknown>
  update: (updates: Partial<DesignerWidget>) => void
  availableCols: string[]
}) {
  const { t } = useTranslation()
  return (
    <>
      <Field label={t('designer.filter_column')}>
        <select
          value={cc.filterColumn as string || ''}
          onChange={e => update({ chartConfig: { ...cc, filterColumn: e.target.value || undefined } })}
          className="input text-sm"
        >
          <option value="">{t('designer.auto_first_column')}</option>
          {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label={t('designer.filter_type')}>
        <select
          value={cc.filterType as string || 'select'}
          onChange={e => update({ chartConfig: { ...cc, filterType: e.target.value } })}
          className="input text-sm"
        >
          <option value="select">{t('designer.filter_types.select')}</option>
          <option value="multi_select">{t('designer.filter_types.multi_select')}</option>
          <option value="text">{t('designer.filter_types.text')}</option>
          <option value="number_range">{t('designer.filter_types.number_range')}</option>
          <option value="date_range">{t('designer.filter_types.date_range')}</option>
        </select>
      </Field>
      <Field label={t('designer.filter_placeholder')}>
        <input
          value={cc.placeholder as string || ''}
          onChange={e => update({ chartConfig: { ...cc, placeholder: e.target.value } })}
          className="input text-sm"
          placeholder={t('designer.filter_placeholder_hint')}
        />
      </Field>
    </>
  )
}
