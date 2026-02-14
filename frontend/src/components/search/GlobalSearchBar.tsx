import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { searchApi, SearchResult } from '@/api/tagsearch'
import { Search, FileBarChart, Database, Code2, X } from 'lucide-react'
import clsx from 'clsx'

const typeIcon: Record<string, typeof FileBarChart> = {
  REPORT: FileBarChart,
  DATASOURCE: Database,
  QUERY: Code2,
}

const typeLink = (r: SearchResult) => {
  switch (r.objectType) {
    case 'REPORT': return `/reports/${r.objectId}`
    case 'DATASOURCE': return '/datasources'
    case 'QUERY': return '/queries'
    default: return '/'
  }
}

export default function GlobalSearchBar() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchApi.search(q.trim(), undefined, undefined, 8)
        setResults(res.results)
        setOpen(true)
        setSelectedIdx(-1)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
  }, [])

  useEffect(() => { doSearch(query) }, [query, doSearch])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) {
      e.preventDefault()
      goTo(results[selectedIdx])
    }
  }

  const goTo = (r: SearchResult) => {
    navigate(typeLink(r))
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="relative" ref={dropRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          className="w-64 lg:w-80 pl-9 pr-8 py-1.5 rounded-lg text-sm
            bg-surface-100 dark:bg-dark-surface-100
            border border-surface-200 dark:border-dark-surface-100
            text-slate-700 dark:text-slate-200
            placeholder-slate-400
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 card shadow-xl z-50 overflow-hidden max-h-96">
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">{t('search.searching')}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">{t('search.no_results', { query })}</div>
          ) : (
            <div className="py-1">
              {results.map((r, idx) => {
                const Icon = typeIcon[r.objectType] || FileBarChart
                return (
                  <button
                    key={`${r.objectType}-${r.objectId}`}
                    onClick={() => goTo(r)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      idx === selectedIdx
                        ? 'bg-brand-50 dark:bg-brand-900/20'
                        : 'hover:bg-surface-50 dark:hover:bg-dark-surface-100'
                    )}
                  >
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {r.name}
                      </p>
                      {r.description && (
                        <p className="text-xs text-slate-400 truncate">{r.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 uppercase flex-shrink-0">
                      {r.objectType}
                    </span>
                    {r.tags.length > 0 && (
                      <div className="flex gap-1 flex-shrink-0">
                        {r.tags.slice(0, 2).map(tg => (
                          <span key={tg.tagId}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: tg.tagColor ? `${tg.tagColor}20` : '#e2e8f0',
                              color: tg.tagColor || '#64748b'
                            }}>
                            {tg.tagName}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
