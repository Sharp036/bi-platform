import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { SavedQuery, DataSource } from '@/types'
import { queryApi } from '@/api/queries'
import { datasourceApi } from '@/api/datasources'
import { Trash2, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'

const CHART_TYPES = ['bar', 'line', 'pie', 'area', 'scatter', 'radar', 'funnel', 'heatmap', 'treemap', 'sankey', 'boxplot', 'gauge', 'waterfall']

export default function PropertyPanel() {
  const { t } = useTranslation()
  const selected = useDesignerStore(s => s.selectedWidgetId)
  const widgets = useDesignerStore(s => s.widgets)
  const updateWidget = useDesignerStore(s => s.updateWidget)
  const removeWidget = useDesignerStore(s => s.removeWidget)
  const duplicateWidget = useDesignerStore(s => s.duplicateWidget)

  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])
  const [availableCols, setAvailableCols] = useState<string[]>([])
  const [loadingCols, setLoadingCols] = useState(false)

  const widget = widgets.find(w => w.id === selected)

  useEffect(() => {
    queryApi.list({ size: 100 }).then(d => setQueries(d.content || [])).catch(() => {})
    datasourceApi.list().then(setDatasources).catch(() => {})
  }, [])

  // Reset columns when widget selection changes
  useEffect(() => { setAvailableCols([]) }, [selected])

  const loadColumns = useCallback(async () => {
    if (!widget) return
    setLoadingCols(true)
    try {
      let res
      if (widget.queryId) {
        res = await queryApi.execute(widget.queryId, undefined, 1)
      } else if (widget.datasourceId && widget.rawSql?.trim()) {
        res = await queryApi.executeAdHoc({ datasourceId: widget.datasourceId, sql: widget.rawSql, limit: 1 })
      }
      if (res?.columns) {
        setAvailableCols(res.columns.map((c: string | { name: string }) => typeof c === 'string' ? c : c.name))
      }
    } catch { /* ignore */ }
    finally { setLoadingCols(false) }
  }, [widget?.queryId, widget?.datasourceId, widget?.rawSql])

  if (!widget) {
    return (
      <div className="p-4 text-center text-sm text-slate-400 dark:text-slate-500">
        {t('designer.select_widget')}
      </div>
    )
  }

  const update = (updates: Partial<DesignerWidget>) => updateWidget(widget.id, updates)

  return (
    <div className="p-3 space-y-4 overflow-y-auto">
      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={() => duplicateWidget(widget.id)} className="btn-ghost p-1.5" title={t('common.duplicate')}>
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={() => update({ isVisible: !widget.isVisible })}
          className="btn-ghost p-1.5" title={widget.isVisible ? t('designer.hide') : t('designer.show')}
        >
          {widget.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={() => { if (confirm(t('designer.delete_widget_confirm'))) removeWidget(widget.id) }}
          className="btn-ghost p-1.5 text-red-500" title={t('common.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-surface-100 dark:bg-dark-surface-100 text-slate-500">
          {widget.widgetType}
        </span>
      </div>

      {/* Title */}
      <Field label={t('designer.widget_title')}>
        <input
          value={widget.title} onChange={e => update({ title: e.target.value })}
          className="input text-sm" placeholder={t('designer.widget_title_placeholder')}
        />
      </Field>

      {/* Position & Size */}
      <Field label={t('designer.layout')}>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">X</label>
            <input type="number" min={0} max={11}
              value={widget.position.x} onChange={e => update({ position: { ...widget.position, x: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Y</label>
            <input type="number" min={0}
              value={widget.position.y} onChange={e => update({ position: { ...widget.position, y: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">W</label>
            <input type="number" min={1} max={12}
              value={widget.position.w} onChange={e => update({ position: { ...widget.position, w: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">H</label>
            <input type="number" min={1}
              value={widget.position.h} onChange={e => update({ position: { ...widget.position, h: Number(e.target.value) } })}
              className="input text-sm py-1"
            />
          </div>
        </div>
      </Field>

      {/* Data Binding */}
      {widget.widgetType !== 'TEXT' && widget.widgetType !== 'IMAGE' && (
        <>
          <Field label={t('designer.data_source')}>
            <select
              value={widget.queryId || ''}
              onChange={e => {
                const qId = e.target.value ? Number(e.target.value) : null
                const q = queries.find(q => q.id === qId)
                update({ queryId: qId, datasourceId: q?.datasourceId || widget.datasourceId })
              }}
              className="input text-sm"
            >
              <option value="">{t('designer.select_query')}</option>
              {queries.map(q => (
                <option key={q.id} value={q.id}>{q.name} ({q.datasourceName})</option>
              ))}
            </select>
          </Field>

          <Field label={t('designer.inline_sql')}>
            <select
              value={widget.datasourceId || ''}
              onChange={e => update({ datasourceId: e.target.value ? Number(e.target.value) : null })}
              className="input text-sm mb-2"
            >
              <option value="">{t('designer.select_datasource')}</option>
              {datasources.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>
              ))}
            </select>
            <textarea
              value={widget.rawSql}
              onChange={e => update({ rawSql: e.target.value })}
              placeholder={t('designer.sql_placeholder')}
              className="input text-xs font-mono h-20 resize-none"
            />
          </Field>
        </>
      )}

      {/* Chart Config */}
      {widget.widgetType === 'CHART' && (() => {
        const cc = widget.chartConfig as Record<string, unknown>
        const catField = cc.categoryField as string || ''
        const valFields = cc.valueFields as string[] || []
        const hasDataSource = !!(widget.queryId || (widget.datasourceId && widget.rawSql?.trim()))

        const handleToggleValue = (col: string) => {
          const allNonCat = availableCols.filter(c => c !== (catField || availableCols[0]))
          const current = valFields.length > 0 ? valFields : allNonCat
          const next = current.includes(col)
            ? current.filter(c => c !== col)
            : [...current, col]
          update({ chartConfig: { ...cc, valueFields: next.length === allNonCat.length ? [] : next } })
        }

        return (
          <>
            <Field label={t('charts.select_type')}>
              <select
                value={cc.type as string || 'bar'}
                onChange={e => update({ chartConfig: { ...cc, type: e.target.value } })}
                className="input text-sm"
              >
                {CHART_TYPES.map(ct => (
                  <option key={ct} value={ct}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>
                ))}
              </select>
            </Field>

            <Field label={t('designer.chart_fields')}>
              <button
                onClick={loadColumns}
                disabled={loadingCols || !hasDataSource}
                className="btn-secondary text-xs w-full gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCols ? 'animate-spin' : ''}`} />
                {loadingCols ? t('designer.loading_columns') : t('designer.load_columns')}
              </button>
              {!hasDataSource && (
                <p className="text-[10px] text-slate-400 mt-1">{t('designer.no_data_source_hint')}</p>
              )}
            </Field>

            {availableCols.length > 0 && (
              <>
                <Field label={t('designer.category_field')}>
                  <select
                    value={catField}
                    onChange={e => update({ chartConfig: { ...cc, categoryField: e.target.value || undefined, valueFields: [] } })}
                    className="input text-sm"
                  >
                    <option value="">{t('designer.auto_first_column')}</option>
                    {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label={t('designer.value_fields')}>
                  <div className="space-y-1 max-h-36 overflow-y-auto border border-surface-200 dark:border-dark-surface-100 rounded-lg p-2">
                    {availableCols
                      .filter(c => c !== (catField || availableCols[0]))
                      .map(col => (
                        <label key={col} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-800 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={valFields.length === 0 || valFields.includes(col)}
                            onChange={() => handleToggleValue(col)}
                            className="rounded border-slate-300"
                          />
                          {col}
                        </label>
                      ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{t('designer.value_fields_hint')}</p>
                </Field>
              </>
            )}
          </>
        )
      })()}

      {/* KPI Config */}
      {widget.widgetType === 'KPI' && (
        <>
          <Field label={t('designer.number_format')}>
            <select
              value={(widget.chartConfig as Record<string, unknown>).format as string || 'number'}
              onChange={e => update({ chartConfig: { ...widget.chartConfig, format: e.target.value } })}
              className="input text-sm"
            >
              <option value="number">{t('designer.format.number')}</option>
              <option value="currency">{t('designer.format.currency')}</option>
              <option value="percent">{t('designer.format.percent')}</option>
            </select>
          </Field>
          <Field label={t('designer.prefix_suffix')}>
            <div className="flex gap-2">
              <input
                value={(widget.chartConfig as Record<string, unknown>).prefix as string || ''}
                onChange={e => update({ chartConfig: { ...widget.chartConfig, prefix: e.target.value } })}
                placeholder={t('designer.prefix')} className="input text-sm flex-1"
              />
              <input
                value={(widget.chartConfig as Record<string, unknown>).suffix as string || ''}
                onChange={e => update({ chartConfig: { ...widget.chartConfig, suffix: e.target.value } })}
                placeholder={t('designer.suffix')} className="input text-sm flex-1"
              />
            </div>
          </Field>
        </>
      )}

      {/* Text content */}
      {widget.widgetType === 'TEXT' && (
        <Field label={t('designer.content_html')}>
          <textarea
            value={widget.title}
            onChange={e => update({ title: e.target.value })}
            className="input text-sm h-32 resize-none font-mono"
            placeholder={t('designer.html_placeholder')}
          />
        </Field>
      )}

      {/* Image */}
      {widget.widgetType === 'IMAGE' && (
        <Field label={t('designer.image_url')}>
          <input
            value={(widget.chartConfig as Record<string, unknown>).url as string || ''}
            onChange={e => update({ chartConfig: { ...widget.chartConfig, url: e.target.value } })}
            className="input text-sm" placeholder="https://..."
          />
        </Field>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
