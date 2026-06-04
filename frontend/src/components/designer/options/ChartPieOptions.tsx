import { useTranslation } from 'react-i18next'
import type { DesignerWidget } from '@/store/useDesignerStore'
import { Field, AddColorValueRow } from '@/components/designer/PropertyPanel'

// Pie / donut specific options: donut toggle, label content, per-segment
// colors, and the donut center label. Rendered only when the chart type is
// pie.
export default function ChartPieOptions({ cc, update, availableCols, previewRows }: {
  cc: Record<string, unknown>
  update: (updates: Partial<DesignerWidget>) => void
  availableCols: string[]
  previewRows: Record<string, unknown>[]
}) {
  const { t } = useTranslation()
  const colorBy = (cc.categoryField as string) || availableCols[0]
  const colorsMap = (cc.colors as Record<string, string> | undefined) || {}
  const sampleDistinct = Array.from(new Set(
    (previewRows || [])
      .map(r => r[colorBy])
      .filter(v => v != null && String(v).trim() !== '')
      .map(v => String(v))
  ))
  const allValues = Array.from(new Set([...sampleDistinct, ...Object.keys(colorsMap)])).sort()
  const setSegColor = (val: string, hex: string) => {
    update({ chartConfig: { ...cc, colors: { ...colorsMap, [val]: hex } } })
  }
  const clearSegColor = (val: string) => {
    const next = { ...colorsMap }
    delete next[val]
    const hasAny = Object.keys(next).length > 0
    update({ chartConfig: { ...cc, colors: hasAny ? next : undefined } })
  }
  type CenterLabelCfg = { text?: string; valueField?: string; fontSize?: number; subtext?: string; color?: string }
  const cl = (cc.centerLabel as CenterLabelCfg | undefined)
  return (
    <>
      <Field label={t('designer.chart_pie_donut')}>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={!!cc.donut}
            onChange={e => update({ chartConfig: { ...cc, donut: e.target.checked || undefined } })}
            className="h-3.5 w-3.5"
          />
          <span className="text-slate-500 dark:text-slate-400">{t('designer.chart_pie_donut_hint')}</span>
        </label>
      </Field>

      <Field label={t('designer.chart_pie_label_content')}>
        <select
          value={(cc.pieLabelContent as string) || (cc.showPercentages ? 'name-percent' : 'name')}
          onChange={e => {
            const v = e.target.value
            update({ chartConfig: { ...cc, pieLabelContent: v === 'name' ? undefined : v, showPercentages: undefined } })
          }}
          className="input text-sm"
        >
          <option value="name">{t('designer.chart_pie_label_content_name')}</option>
          <option value="value">{t('designer.chart_pie_label_content_value')}</option>
          <option value="percent">{t('designer.chart_pie_label_content_percent')}</option>
          <option value="name-value">{t('designer.chart_pie_label_content_name_value')}</option>
          <option value="name-percent">{t('designer.chart_pie_label_content_name_percent')}</option>
        </select>
        <p className="text-[10px] text-slate-400 mt-1">{t('designer.chart_pie_label_content_hint')}</p>
      </Field>

      <Field label={t('designer.chart_pie_segment_colors')}>
        <p className="text-[10px] text-slate-400 mb-1">{t('designer.chart_pie_segment_colors_hint')}</p>
        {allValues.length === 0 ? (
          <p className="text-[10px] text-slate-400 px-1">{t('designer.row_color_preview_needed')}</p>
        ) : (
          <div className="space-y-1 border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
            {allValues.map(val => {
              const hex = colorsMap[val] || ''
              return (
                <div key={val} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate text-slate-600 dark:text-slate-300" title={val}>{val}</span>
                  <input
                    type="color"
                    value={hex || '#cccccc'}
                    onChange={e => setSegColor(val, e.target.value)}
                    className="w-5 h-5 border-0 rounded cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={hex}
                    onChange={e => {
                      const v = e.target.value.trim()
                      if (v === '') { clearSegColor(val); return }
                      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) setSegColor(val, v.toLowerCase())
                    }}
                    placeholder="#rrggbb"
                    maxLength={7}
                    className="w-16 font-mono text-[10px] px-1 py-0.5 border border-surface-200 dark:border-dark-surface-100 rounded bg-white dark:bg-dark-surface-50"
                  />
                  {hex && (
                    <button
                      onClick={() => clearSegColor(val)}
                      title={t('common.clear')}
                      className="text-slate-400 hover:text-red-500"
                    >×</button>
                  )}
                </div>
              )
            })}
            <AddColorValueRow
              existingValues={allValues}
              defaultColor="#cccccc"
              onAdd={(val, hex) => setSegColor(val, hex)}
              placeholder={t('designer.row_color_add_value')}
            />
          </div>
        )}
      </Field>

      {!!cc.donut && (
        <Field label={t('designer.chart_pie_center_label')}>
          <div className="space-y-1.5 text-xs">
            <input
              type="text"
              value={cl?.text || ''}
              onChange={e => update({ chartConfig: { ...cc, centerLabel: { ...(cl || {}), text: e.target.value || undefined } } })}
              placeholder={t('designer.chart_pie_center_text')}
              className="input text-xs"
            />
            <select
              value={cl?.valueField || ''}
              onChange={e => update({ chartConfig: { ...cc, centerLabel: { ...(cl || {}), valueField: e.target.value || undefined } } })}
              className="input text-xs"
            >
              <option value="">{t('designer.chart_pie_center_static')}</option>
              {availableCols.map(c => <option key={c} value={c}>{t('designer.chart_pie_center_sum_of', { col: c })}</option>)}
            </select>
            <input
              type="text"
              value={cl?.subtext || ''}
              onChange={e => update({ chartConfig: { ...cc, centerLabel: { ...(cl || {}), subtext: e.target.value || undefined } } })}
              placeholder={t('designer.chart_pie_center_subtext')}
              className="input text-xs"
            />
            <p className="text-[10px] text-slate-400">{t('designer.chart_pie_center_hint')}</p>
          </div>
        </Field>
      )}
    </>
  )
}
