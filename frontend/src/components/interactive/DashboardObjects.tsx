import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

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

interface RichTextWidgetProps {
  content: string
  style?: Record<string, unknown>
}

export function RichTextWidget({ content, style }: RichTextWidgetProps) {
  const customStyle: React.CSSProperties = {
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    color: style?.color as string | undefined,
    backgroundColor: style?.backgroundColor as string | undefined,
    textAlign: (style?.textAlign as 'left' | 'center' | 'right') || undefined,
    padding: style?.padding ? `${style.padding}px` : undefined,
  }

  return (
    <div className="h-full flex items-center p-4">
      <div
        className="prose dark:prose-invert text-sm w-full max-w-none"
        style={customStyle}
        dangerouslySetInnerHTML={{ __html: content }}
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
