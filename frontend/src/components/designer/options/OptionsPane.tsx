import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Search } from 'lucide-react'
import clsx from 'clsx'
import NumericInput from '@/components/common/NumericInput'
import type { OptionCtx, OptionDef, OptionCategoryDef } from './types'

const LS_KEY = 'designer_options_expanded'

// Persisted map of category id -> expanded. A category with no entry is
// collapsed by default (cleaner first impression); the user expands what they
// need and the choice is remembered.
function loadExpanded(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

// Options renderer: collapsible categories + a search box that flattens and
// filters options by name. Driven entirely by the OptionDef[] registry, so
// adding an option requires no layout work here.
export default function OptionsPane({ options, categories, ctx }: {
  options: OptionDef[]
  categories: OptionCategoryDef[]
  ctx: OptionCtx
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded)

  const toggle = (id: string) => setExpanded(prev => {
    const next = { ...prev, [id]: !prev[id] }
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })

  const visible = useMemo(
    () => options.filter(o => !o.showIf || o.showIf(ctx)),
    [options, ctx],
  )

  const q = search.trim().toLowerCase()
  const searching = q.length > 0
  const matched = searching ? visible.filter(o => t(o.nameKey).toLowerCase().includes(q)) : visible

  const editor = (o: OptionDef) => {
    if (o.render) return o.render(ctx)
    switch (o.editor) {
      case 'text':
        return (
          <input
            className="input text-sm"
            value={String(o.get?.(ctx) ?? '')}
            placeholder={o.placeholderKey ? t(o.placeholderKey) : undefined}
            onChange={e => o.set?.(ctx, e.target.value)}
          />
        )
      case 'number':
        return (
          <NumericInput
            className="input text-sm"
            value={o.get?.(ctx) != null ? Number(o.get?.(ctx)) : undefined}
            onChange={v => o.set?.(ctx, v)}
          />
        )
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-300"
              checked={!!o.get?.(ctx)} onChange={e => o.set?.(ctx, e.target.checked)} />
            {t(o.nameKey)}
          </label>
        )
      case 'color':
        return (
          <input type="color" className="w-8 h-8 border-0 rounded cursor-pointer bg-transparent"
            value={String(o.get?.(ctx) || '#5470c6')} onChange={e => o.set?.(ctx, e.target.value)} />
        )
      case 'select':
        return (
          <select className="input text-sm" value={String(o.get?.(ctx) ?? '')}
            onChange={e => o.set?.(ctx, e.target.value)}>
            {(o.selectOptions?.(ctx) || []).map(s => (
              <option key={s.value} value={s.value}>{t(s.nameKey)}</option>
            ))}
          </select>
        )
      default:
        return null
    }
  }

  const field = (o: OptionDef) => (
    <div key={o.id}>
      {/* Checkbox editors render their own inline label; an empty nameKey means
          the custom render supplies its own heading (e.g. param mapping). */}
      {o.editor !== 'checkbox' && o.nameKey && (
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t(o.nameKey)}</label>
      )}
      {editor(o)}
      {o.hintKey && <p className="text-[10px] text-slate-400 mt-1">{t(o.hintKey)}</p>}
    </div>
  )

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t('designer.search_options')}
        className="input text-sm pl-8"
      />
    </div>
  )

  if (searching) {
    return (
      <div className="space-y-3">
        {searchBox}
        {matched.length === 0
          ? <p className="text-xs text-slate-400 px-1">{t('designer.no_options_found')}</p>
          : <div className="space-y-3">{matched.map(field)}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {searchBox}
      {categories.map(cat => {
        const opts = matched.filter(o => o.category === cat.id)
        if (opts.length === 0) return null
        const isCollapsed = !expanded[cat.id]
        return (
          <div key={cat.id} className="border-b border-surface-200 dark:border-dark-surface-100 last:border-0">
            <button
              type="button"
              onClick={() => toggle(cat.id)}
              className="w-full flex items-center gap-2 py-2 text-left"
            >
              <ChevronDown className={clsx('w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0', isCollapsed && '-rotate-90')} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t(cat.nameKey)}</span>
            </button>
            {!isCollapsed && <div className="pb-3 space-y-3">{opts.map(field)}</div>}
          </div>
        )
      })}
    </div>
  )
}
