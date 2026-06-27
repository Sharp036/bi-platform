import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useThemeStore } from '@/store/themeStore'

// ═══════════════════════════════════════════
//  Web Page Widget (iframe embed)
// ═══════════════════════════════════════════

interface WebPageWidgetProps {
  url: string
  title?: string
  allowFullscreen?: boolean
}

export function WebPageWidget({ url, title, allowFullscreen = true }: WebPageWidgetProps) {
  const { t } = useTranslation()
  if (!url) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        {t('interactive.dashboard.no_url')}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {title && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 px-1 flex-shrink-0">
          {title}
        </h3>
      )}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-surface-200 dark:border-dark-surface-100">
        <iframe
          src={url}
          title={title || t('interactive.dashboard.embedded_content')}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
          allowFullScreen={allowFullscreen}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
//  Spacer Widget
// ═══════════════════════════════════════════

interface SpacerWidgetProps {
  height?: number
  color?: string
}

export function SpacerWidget({ height, color }: SpacerWidgetProps) {
  return (
    <div
      className="w-full"
      style={{
        height: height ? `${height}px` : '100%',
        backgroundColor: color || 'transparent',
      }}
    />
  )
}

// ═══════════════════════════════════════════
//  Divider Widget
// ═══════════════════════════════════════════

interface DividerWidgetProps {
  orientation?: 'horizontal' | 'vertical'
  color?: string
  thickness?: number
  style?: 'solid' | 'dashed' | 'dotted'
  label?: string
}

export function DividerWidget({
  orientation = 'horizontal', color, thickness = 1, style = 'solid', label
}: DividerWidgetProps) {
  if (orientation === 'vertical') {
    return (
      <div className="h-full flex items-center justify-center px-2">
        <div
          className="h-full"
          style={{
            width: `${thickness}px`,
            borderLeft: `${thickness}px ${style} ${color || '#e2e8f0'}`,
          }}
        />
      </div>
    )
  }

  if (label) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1" style={{ borderTop: `${thickness}px ${style} ${color || '#e2e8f0'}` }} />
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className="flex-1" style={{ borderTop: `${thickness}px ${style} ${color || '#e2e8f0'}` }} />
      </div>
    )
  }

  return (
    <div className="py-2">
      <div style={{ borderTop: `${thickness}px ${style} ${color || '#e2e8f0'}` }} />
    </div>
  )
}

// ═══════════════════════════════════════════
//  Rich Text Widget (enhanced TEXT)
// ═══════════════════════════════════════════

import type { WidgetData } from '@/types'

interface RichTextWidgetProps {
  content: string
  style?: Record<string, unknown>
  // When provided, placeholders {columnName} or {columnName:format} in content are
  // replaced with values from data.rows[0]. Supported formats:
  //   {col}               — toLocaleString() for numbers, String() for text
  //   {col:int}           — Math.round + toLocaleString
  //   {col:fixed2}        — toFixed(2)
  //   {col:percent1}      — (v*100).toFixed(1) + '%'
  //   {col:millions}      — (v/1_000_000).toFixed(2) + ' млн'
  // Missing columns render as em-dash.
  //
  // Conditional blocks: {{#if colName}}...{{/if}} keeps the inner HTML iff
  // row[colName] is truthy (non-null, non-zero, non-empty, non-'false').
  // Nested blocks are supported; falsy blocks are dropped before placeholder
  // substitution so their inner tokens never need to resolve.
  data?: WidgetData
}

const PLACEHOLDER_RE = /\{([A-Za-zА-Яа-я0-9_\-.,% ]+?)(?::([a-zA-Z0-9]+))?\}/g
// Conditional block: {{#if colName}}...{{/if}} renders the body iff
// row[colName] is truthy. Falsy values: null, undefined, false, 0, '0', '',
// 'false'. The loop handles nested blocks by replacing inside-out until
// the string stabilises.
const CONDITIONAL_RE = /\{\{#if\s+([A-Za-zА-Яа-я0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g

function isTruthyForBlock(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (value === false || value === 0) return false
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === '' || trimmed === '0' || trimmed === 'false') return false
  }
  return true
}

function processConditionals(content: string, row: Record<string, unknown>): string {
  let result = content
  let prev: string
  do {
    prev = result
    result = result.replace(CONDITIONAL_RE, (_match, colName, body) => {
      const value = row[String(colName).trim()]
      return isTruthyForBlock(value) ? body : ''
    })
  } while (result !== prev)
  return result
}

function formatPlaceholderValue(value: unknown, format?: string): string {
  if (value == null) return '—'
  const num = Number(value)
  const hasNum = Number.isFinite(num)
  switch (format) {
    case 'int':
      return hasNum ? Math.round(num).toLocaleString() : String(value)
    case 'fixed1':
      return hasNum ? num.toFixed(1) : String(value)
    case 'fixed2':
      return hasNum ? num.toFixed(2) : String(value)
    case 'fixed3':
      return hasNum ? num.toFixed(3) : String(value)
    case 'percent':
    case 'percent1':
      return hasNum ? `${(num * 100).toFixed(1)}%` : String(value)
    case 'percent0':
      return hasNum ? `${Math.round(num * 100)}%` : String(value)
    case 'thousands':
      return hasNum ? `${(num / 1000).toFixed(1)}K` : String(value)
    case 'millions':
      return hasNum ? `${(num / 1_000_000).toFixed(2)} млн` : String(value)
    default:
      return hasNum ? num.toLocaleString() : String(value)
  }
}

function interpolateContent(content: string, data?: WidgetData): string {
  if (!data || !data.rows || data.rows.length === 0) return content
  const row = data.rows[0]
  // Conditional blocks first so falsy ones drop the surrounding HTML before
  // the placeholder pass tries to substitute their inner tokens.
  const withConditionals = processConditionals(content, row)
  return withConditionals.replace(PLACEHOLDER_RE, (match, colName, format) => {
    const trimmed = String(colName).trim()
    if (!(trimmed in row)) return match  // leave unknown placeholders as-is
    return formatPlaceholderValue(row[trimmed], format)
  })
}

// Parse a CSS color (#rgb, #rrggbb, rgb()/rgba()) to [r,g,b] in 0-255. Returns
// null for anything else (named colors, hsl, ...) so the caller leaves those
// declarations untouched.
function parseCssColor(input: string): [number, number, number] | null {
  const s = input.trim().toLowerCase()
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  return la >= lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05)
}

// Approximate dark-theme background behind a text widget, and the minimum
// contrast below which a hardcoded color is treated as unreadable.
const DARK_THEME_BG: [number, number, number] = [30, 30, 46]
const MIN_CONTRAST = 2.5

function readableOnDark(color: string): boolean {
  const rgb = parseCssColor(color)
  return rgb ? contrastRatio(rgb, DARK_THEME_BG) >= MIN_CONTRAST : true
}

// Widget HTML may hardcode an inline `color:` that overrides the theme-aware
// `prose dark:prose-invert` color and turns unreadable in dark theme (dark text
// on dark background). In dark theme, drop only those `color` declarations whose
// contrast against the dark background is too low, so `prose` supplies a readable
// color; accent colors (green/red/...) keep enough contrast and stay untouched.
function dropUnreadableInlineColors(html: string): string {
  return html.replace(/([;\s"'{])color\s*:\s*([^;"'}]+)/gi, (match, pre: string, value: string) =>
    readableOnDark(value) ? match : pre
  )
}

export function RichTextWidget({ content, style, data }: RichTextWidgetProps) {
  const isDark = useThemeStore(s => s.isDark)
  const widgetColor = style?.color as string | undefined
  const customStyle: React.CSSProperties = {
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    // Drop a widget-level color that is unreadable in dark theme so prose's
    // theme color applies instead.
    color: widgetColor && (!isDark || readableOnDark(widgetColor)) ? widgetColor : undefined,
    backgroundColor: style?.backgroundColor as string | undefined,
    textAlign: (style?.textAlign as 'left' | 'center' | 'right') || undefined,
    padding: style?.padding ? `${style.padding}px` : undefined,
  }

  const rendered = data ? interpolateContent(content, data) : content
  const themedHtml = isDark ? dropUnreadableInlineColors(rendered) : rendered

  return (
    <div className="h-full flex items-center p-4">
      <div
        className="prose dark:prose-invert text-sm w-full max-w-none"
        style={customStyle}
        dangerouslySetInnerHTML={{ __html: themedHtml }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════
//  Enhanced Image Widget
// ═══════════════════════════════════════════

interface ImageWidgetProps {
  src: string
  alt?: string
  linkUrl?: string
  fit?: 'contain' | 'cover' | 'fill'
  borderRadius?: number
}

export function ImageWidget({ src, alt, linkUrl, fit = 'contain', borderRadius = 0 }: ImageWidgetProps) {
  const img = (
    <img
      src={src}
      alt={alt || ''}
      className="max-w-full max-h-full"
      style={{
        objectFit: fit,
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
      }}
    />
  )

  return (
    <div className="h-full flex items-center justify-center p-2">
      {linkUrl ? (
        <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
          {img}
        </a>
      ) : img}
    </div>
  )
}

// ═══════════════════════════════════════════
//  Download Button Widget
// ═══════════════════════════════════════════

interface DownloadButtonWidgetProps {
  reportId: number
  format: string
  label?: string
  color?: string
}

export function DownloadButtonWidget({ reportId, format, label, color }: DownloadButtonWidgetProps) {
  const handleDownload = async () => {
    const { exportApi } = await import('@/api/export')
    exportApi.exportAndSave(reportId, format)
  }

  return (
    <div className="h-full flex items-center justify-center p-2">
      <button
        onClick={handleDownload}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-white"
        style={{ backgroundColor: color || '#10b981' }}
      >
        ⬇ {label || `Download ${format.toUpperCase()}`}
      </button>
    </div>
  )
}
