import type { ReactNode } from 'react'

/**
 * Tiny markdown renderer for short tooltip / hint texts. Supports inline:
 * **bold**, *italic*, `code`, [text](url); block: paragraphs separated by
 * blank lines, bullet lists (- or *), ordered lists (1. ). Output is built
 * as React elements directly - never via dangerouslySetInnerHTML, so user
 * text cannot inject markup. URLs are validated against a small allowlist
 * (http/https/mailto/relative/anchor) so a description with `javascript:`
 * link does not become an XSS vector.
 *
 * Not a CommonMark replacement. If we need full markdown later, swap this
 * out for react-markdown - the API stays the same (text in, JSX out).
 */

type Token =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'link'; content: string; url: string }

function isSafeUrl(url: string): boolean {
  const t = url.trim().toLowerCase()
  return t.startsWith('http://') || t.startsWith('https://') ||
         t.startsWith('mailto:') || t.startsWith('/') || t.startsWith('#')
}

function parseInline(s: string): Token[] {
  const out: Token[] = []
  let buf = ''
  let i = 0

  const flush = () => {
    if (buf) { out.push({ type: 'text', content: buf }); buf = '' }
  }

  while (i < s.length) {
    const c = s[i]

    if (c === '`') {
      const end = s.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ type: 'code', content: s.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (c === '[') {
      const closeBracket = s.indexOf(']', i + 1)
      if (closeBracket > 0 && s[closeBracket + 1] === '(') {
        const closeParen = s.indexOf(')', closeBracket + 2)
        if (closeParen > 0) {
          const url = s.slice(closeBracket + 2, closeParen)
          if (isSafeUrl(url)) {
            flush()
            out.push({ type: 'link', content: s.slice(i + 1, closeBracket), url })
            i = closeParen + 1
            continue
          }
        }
      }
    }

    if ((c === '*' && s[i + 1] === '*') || (c === '_' && s[i + 1] === '_')) {
      const marker = c + c
      const end = s.indexOf(marker, i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: 'bold', content: s.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }

    if (c === '*' || c === '_') {
      const end = s.indexOf(c, i + 1)
      if (end > i + 1 && /\S/.test(s[end - 1])) {
        flush()
        out.push({ type: 'italic', content: s.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    buf += c
    i++
  }

  flush()
  return out
}

function renderInline(tokens: Token[]): ReactNode[] {
  return tokens.map((tok, i) => {
    switch (tok.type) {
      case 'text':   return <span key={i}>{tok.content}</span>
      case 'bold':   return <strong key={i} className="font-semibold">{tok.content}</strong>
      case 'italic': return <em key={i}>{tok.content}</em>
      case 'code':   return <code key={i} className="px-1 py-0.5 bg-slate-700 dark:bg-slate-950 rounded text-[0.85em] font-mono">{tok.content}</code>
      case 'link':   return <a key={i} href={tok.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">{tok.content}</a>
    }
  })
}

interface Props {
  text: string
  className?: string
}

export default function MarkdownLite({ text, className }: Props) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []

  const flushPara = () => {
    if (para.length === 0) return
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {renderInline(parseInline(para.join(' ')))}
      </p>,
    )
    para = []
  }
  const flushList = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    const cls = list.ordered ? 'list-decimal pl-4' : 'list-disc pl-4'
    blocks.push(
      <Tag key={`l-${blocks.length}`} className={cls}>
        {list.items.map((item, i) => (
          <li key={i}>{renderInline(parseInline(item))}</li>
        ))}
      </Tag>,
    )
    list = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trim() === '') {
      flushPara(); flushList()
      continue
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/)
    if (bullet) {
      flushPara()
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] } }
      list.items.push(bullet[1])
      continue
    }
    if (ordered) {
      flushPara()
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] } }
      list.items.push(ordered[1])
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara(); flushList()

  return <div className={className}>{blocks}</div>
}
