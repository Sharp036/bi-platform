import { useEffect, useState } from 'react'
import { useDesignerStore } from '@/store/useDesignerStore'
import type { DesignerWidget } from '@/store/useDesignerStore'
import type { SavedQuery, DataSource } from '@/types'
import { queryApi } from '@/api/queries'
import { datasourceApi } from '@/api/datasources'
import { Trash2, Copy, Eye, EyeOff } from 'lucide-react'

const CHART_TYPES = ['bar', 'line', 'pie', 'area', 'scatter', 'radar', 'funnel', 'heatmap', 'treemap', 'sankey', 'boxplot', 'gauge', 'waterfall']

export default function PropertyPanel() {
  const selected = useDesignerStore(s => s.selectedWidgetId)
  const widgets = useDesignerStore(s => s.widgets)
  const updateWidget = useDesignerStore(s => s.updateWidget)
  const removeWidget = useDesignerStore(s => s.removeWidget)
  const duplicateWidget = useDesignerStore(s => s.duplicateWidget)

  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [datasources, setDatasources] = useState<DataSource[]>([])

  const widget = widgets.find(w => w.id === selected)

  useEffect(() => {
    queryApi.list({ size: 100 }).then(d => setQueries(d.content || [])).catch(() => {})
    datasourceApi.list().then(setDatasources).catch(() => {})
  }, [])

  if (!widget) {
    return (
      <div className="p-4 text-center text-sm text-slate-400 dark:text-slate-500">
        Select a widget to edit its properties
      </div>
    )
  }

  const update = (updates: Partial<DesignerWidget>) => updateWidget(widget.id, updates)

  return (
    <div className="p-3 space-y-4 overflow-y-auto">
      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={() => duplicateWidget(widget.id)} className="btn-ghost p-1.5" title="Duplicate">
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={() => update({ isVisible: !widget.isVisible })}
          className="btn-ghost p-1.5" title={widget.isVisible ? 'Hide' : 'Show'}
        >
          {widget.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={() => { if (confirm('Delete widget?')) removeWidget(widget.id) }}
          className="btn-ghost p-1.5 text-red-500" title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-surface-100 dark:bg-dark-surface-100 text-slate-500">
          {widget.widgetType}
        </span>
      </div>

      {/* Title */}
      <Field label="Title">
        <input
          value={widget.title} onChange={e => update({ title: e.target.value })}
          className="input text-sm" placeholder="Widget title"
        />
      </Field>

      {/* Position & Size */}
      <Field label="Layout (grid: 12 columns)">
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
          <Field label="Data Source">
            <select
              value={widget.queryId || ''}
              onChange={e => {
                const qId = e.target.value ? Number(e.target.value) : null
                const q = queries.find(q => q.id === qId)
                update({ queryId: qId, datasourceId: q?.datasourceId || widget.datasourceId })
              }}
              className="input text-sm"
            >
              <option value="">— Select saved query —</option>
              {queries.map(q => (
                <option key={q.id} value={q.id}>{q.name} ({q.datasourceName})</option>
              ))}
            </select>
          </Field>

          <Field label="Or inline SQL">
            <select
              value={widget.datasourceId || ''}
              onChange={e => update({ datasourceId: e.target.value ? Number(e.target.value) : null })}
              className="input text-sm mb-2"
            >
              <option value="">— Datasource —</option>
              {datasources.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>
              ))}
            </select>
            <textarea
              value={widget.rawSql}
              onChange={e => update({ rawSql: e.target.value })}
              placeholder="SELECT * FROM ..."
              className="input text-xs font-mono h-20 resize-none"
            />
          </Field>
        </>
      )}

      {/* Chart Config */}
      {widget.widgetType === 'CHART' && (
        <Field label="Chart Type">
          <select
            value={(widget.chartConfig as Record<string, unknown>).type as string || 'bar'}
            onChange={e => update({ chartConfig: { ...widget.chartConfig, type: e.target.value } })}
            className="input text-sm"
          >
            {CHART_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </Field>
      )}

      {/* KPI Config */}
      {widget.widgetType === 'KPI' && (
        <>
          <Field label="Number Format">
            <select
              value={(widget.chartConfig as Record<string, unknown>).format as string || 'number'}
              onChange={e => update({ chartConfig: { ...widget.chartConfig, format: e.target.value } })}
              className="input text-sm"
            >
              <option value="number">Number</option>
              <option value="currency">Currency ($)</option>
              <option value="percent">Percent (%)</option>
            </select>
          </Field>
          <Field label="Prefix / Suffix">
            <div className="flex gap-2">
              <input
                value={(widget.chartConfig as Record<string, unknown>).prefix as string || ''}
                onChange={e => update({ chartConfig: { ...widget.chartConfig, prefix: e.target.value } })}
                placeholder="Prefix" className="input text-sm flex-1"
              />
              <input
                value={(widget.chartConfig as Record<string, unknown>).suffix as string || ''}
                onChange={e => update({ chartConfig: { ...widget.chartConfig, suffix: e.target.value } })}
                placeholder="Suffix" className="input text-sm flex-1"
              />
            </div>
          </Field>
        </>
      )}

      {/* Text content */}
      {widget.widgetType === 'TEXT' && (
        <Field label="Content (HTML)">
          <textarea
            value={widget.title}
            onChange={e => update({ title: e.target.value })}
            className="input text-sm h-32 resize-none font-mono"
            placeholder="<h2>Title</h2><p>Content...</p>"
          />
        </Field>
      )}

      {/* Image */}
      {widget.widgetType === 'IMAGE' && (
        <Field label="Image URL">
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
