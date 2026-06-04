import { useTranslation } from 'react-i18next'
import NumericInput from '@/components/common/NumericInput'
import type { DesignerWidget } from '@/store/useDesignerStore'
import { Field, ColorStopsEditor, CURRENCIES } from '@/components/designer/PropertyPanel'

// KPI widget configuration: value/label columns + aggregation, number format,
// decimals, currency, prefix/suffix, threshold color stops, background tint,
// optional sparkline and delta column.
export default function KpiConfigOptions({ cc, update, availableCols }: {
  cc: Record<string, unknown>
  update: (updates: Partial<DesignerWidget>) => void
  availableCols: string[]
}) {
  const { t } = useTranslation()
  return (
    <>
      {availableCols.length > 0 && (
        <>
          <Field label={t('designer.kpi_value_column')}>
            <select
              value={cc.valueColumn as string || ''}
              onChange={e => update({ chartConfig: { ...cc, valueColumn: e.target.value || undefined } })}
              className="input text-sm"
            >
              <option value="">{t('designer.auto_first_column')}</option>
              {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t('designer.kpi_aggregation')}>
            <select
              value={cc.aggregation as string || 'first'}
              onChange={e => update({ chartConfig: { ...cc, aggregation: e.target.value } })}
              className="input text-sm"
            >
              <option value="first">{t('designer.agg.first')}</option>
              <option value="last">{t('designer.agg.last')}</option>
              <option value="sum">{t('designer.agg.sum')}</option>
              <option value="avg">{t('designer.agg.avg')}</option>
              <option value="min">{t('designer.agg.min')}</option>
              <option value="max">{t('designer.agg.max')}</option>
              <option value="count">{t('designer.agg.count')}</option>
            </select>
          </Field>
          <Field label={t('designer.kpi_label_column')}>
            <select
              value={cc.labelColumn as string || ''}
              onChange={e => update({ chartConfig: { ...cc, labelColumn: e.target.value || undefined } })}
              className="input text-sm"
            >
              <option value="">{t('common.none')}</option>
              {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </>
      )}
      <Field label={t('designer.number_format')}>
        <select
          value={cc.format as string || 'number'}
          onChange={e => update({ chartConfig: { ...cc, format: e.target.value } })}
          className="input text-sm"
        >
          <option value="number">{t('designer.format.number')}</option>
          <option value="thousands">{t('designer.format.thousands')}</option>
          <option value="millions">{t('designer.format.millions')}</option>
          <option value="billions">{t('designer.format.billions')}</option>
          <option value="currency">{t('designer.format.currency')}</option>
          <option value="percent">{t('designer.format.percent')}</option>
        </select>
      </Field>

      <Field label={t('designer.kpi_decimals')}>
        <NumericInput
          value={cc.decimals as number | undefined}
          onChange={v => update({
            chartConfig: {
              ...cc,
              decimals: v != null ? Math.max(0, Math.min(6, Math.floor(v))) : undefined,
            },
          })}
          className="input text-sm"
          placeholder={t('designer.kpi_decimals_placeholder')}
        />
        <p className="text-[10px] text-slate-400 mt-1">{t('designer.kpi_decimals_hint')}</p>
      </Field>

      {cc.format === 'currency' && (
        <Field label={t('designer.currency')}>
          <select
            value={cc.currency as string || 'USD'}
            onChange={e => update({ chartConfig: { ...cc, currency: e.target.value } })}
            className="input text-sm"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.symbol} {c.code} - {c.name}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label={t('designer.prefix_suffix')}>
        <div className="flex gap-2">
          <input
            value={cc.prefix as string || ''}
            onChange={e => update({ chartConfig: { ...cc, prefix: e.target.value } })}
            placeholder={t('designer.prefix')} className="input text-sm flex-1"
          />
          <input
            value={cc.suffix as string || ''}
            onChange={e => update({ chartConfig: { ...cc, suffix: e.target.value } })}
            placeholder={t('designer.suffix')} className="input text-sm flex-1"
          />
        </div>
      </Field>

      <Field label={t('designer.kpi_color_mode')}>
        <select
          value={cc.colorMode as string || 'step'}
          onChange={e => update({ chartConfig: { ...cc, colorMode: e.target.value } })}
          className="input text-sm"
        >
          <option value="step">{t('designer.kpi_color_mode.step')}</option>
          <option value="gradient">{t('designer.kpi_color_mode.gradient')}</option>
        </select>
      </Field>

      <Field label={t('designer.kpi_color_stops')}>
        <ColorStopsEditor
          stops={(cc.colorStops as Array<{ at: number; color: string }>) || []}
          onChange={next => update({ chartConfig: { ...cc, colorStops: next.length ? next : undefined } })}
          addLabel={t('designer.kpi_add_stop')}
        />
        <p className="text-[10px] text-slate-400 mt-1">{t('designer.kpi_color_stops_hint')}</p>
      </Field>

      <Field label={t('designer.kpi_tint_background')}>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={!!cc.tintBackground}
            onChange={e => update({ chartConfig: { ...cc, tintBackground: e.target.checked || undefined } })}
            className="h-3.5 w-3.5"
          />
          <span className="text-slate-500 dark:text-slate-400">{t('designer.kpi_tint_background')}</span>
        </label>
      </Field>

      {availableCols.length > 0 && (
        <>
          <Field label={t('designer.kpi_sparkline_field')}>
            <select
              value={cc.sparklineField as string || ''}
              onChange={e => update({ chartConfig: { ...cc, sparklineField: e.target.value || undefined } })}
              className="input text-sm"
            >
              <option value="">{t('common.none')}</option>
              {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {!!cc.sparklineField && (
            <>
              <Field label={t('designer.kpi_sparkline_color_from_stops')}>
                <label className="inline-flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={!!cc.sparklineColorFromStops}
                    onChange={e => update({ chartConfig: { ...cc, sparklineColorFromStops: e.target.checked || undefined } })}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-slate-500 dark:text-slate-400">{t('designer.kpi_sparkline_color_from_stops')}</span>
                </label>
              </Field>
              {!cc.sparklineColorFromStops && (
                <Field label={t('designer.kpi_sparkline_color')}>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={cc.sparklineColor as string || '#3b82f6'}
                      onChange={e => update({ chartConfig: { ...cc, sparklineColor: e.target.value } })}
                      className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={cc.sparklineColor as string || ''}
                      onChange={e => update({ chartConfig: { ...cc, sparklineColor: e.target.value || undefined } })}
                      placeholder="#3b82f6"
                      className="input text-xs flex-1 font-mono"
                    />
                  </div>
                </Field>
              )}
            </>
          )}
          <Field label={t('designer.kpi_delta_column')}>
            <select
              value={cc.deltaColumn as string || ''}
              onChange={e => update({ chartConfig: { ...cc, deltaColumn: e.target.value || undefined } })}
              className="input text-sm"
            >
              <option value="">{t('common.none')}</option>
              {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </>
      )}
    </>
  )
}
