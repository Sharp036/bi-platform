import NumericInput from '@/components/common/NumericInput'
import type { OptionCtx, OptionDef, OptionCategoryDef } from './types'

// Categories shared by all widget types (the panel header block). CHART/TABLE/
// etc. specific categories are appended per widget type in later phases.
export const COMMON_CATEGORIES: OptionCategoryDef[] = [
  { id: 'general', nameKey: 'designer.section_general' },
  { id: 'layout', nameKey: 'designer.section_layout' },
]

const NO_DESC_TYPES = ['SPACER', 'DIVIDER', 'TEXT']

export const COMMON_OPTIONS: OptionDef[] = [
  {
    id: 'title',
    category: 'general',
    nameKey: 'designer.widget_title',
    editor: 'text',
    placeholderKey: 'designer.widget_title_placeholder',
    hintKey: 'designer.title_interpolation_hint',
    get: c => c.widget.title,
    set: (c, v) => c.update({ title: String(v ?? '') }),
  },
  {
    id: 'description',
    category: 'general',
    nameKey: 'designer.widget_description',
    hintKey: 'designer.widget_description_hint',
    showIf: c => !NO_DESC_TYPES.includes(c.widget.widgetType),
    render: (c: OptionCtx) => (
      <textarea
        value={(c.cc.description as string) || ''}
        onChange={e => c.update({ chartConfig: { ...c.widget.chartConfig, description: e.target.value || undefined } })}
        className="input text-sm h-20 resize-none"
        placeholder={c.t('designer.widget_description_placeholder')}
      />
    ),
  },
  {
    id: 'layout',
    category: 'layout',
    nameKey: 'designer.layout',
    render: (c: OptionCtx) => {
      const p = c.widget.position
      const set = (patch: Partial<typeof p>) => c.update({ position: { ...p, ...patch } })
      return (
        <div className="grid grid-cols-4 gap-2">
          {(['x', 'y', 'w', 'h'] as const).map(axis => (
            <div key={axis}>
              <label className="text-[10px] text-slate-400 uppercase">{axis}</label>
              <NumericInput
                value={p[axis]}
                onChange={v => set({ [axis]: v ?? (axis === 'w' || axis === 'h' ? 1 : 0) } as Partial<typeof p>)}
                className="input text-sm py-1"
              />
            </div>
          ))}
        </div>
      )
    },
  },
  {
    id: 'zindex',
    category: 'layout',
    nameKey: 'designer.zindex',
    editor: 'number',
    get: c => Number((c.widget.style as Record<string, unknown>).zIndex ?? 0),
    set: (c, v) => c.update({ style: { ...c.widget.style, zIndex: Number(v) || 0 } }),
  },
]
