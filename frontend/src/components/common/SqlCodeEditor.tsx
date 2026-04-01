import { useRef, useEffect, useCallback } from 'react'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { sql, StandardSQL } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { autocompletion } from '@codemirror/autocomplete'
import { basicSetup } from 'codemirror'
import { useThemeStore } from '@/store/themeStore'

interface Props {
  value: string
  onChange?: (value: string) => void
  onExecute?: () => void
  readOnly?: boolean
  placeholder?: string
  className?: string
}

export default function SqlCodeEditor({ value, onChange, onExecute, readOnly, placeholder, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const isDark = useThemeStore(s => s.isDark)
  const onChangeRef = useRef(onChange)
  const onExecuteRef = useRef(onExecute)
  onChangeRef.current = onChange
  onExecuteRef.current = onExecute

  const createState = useCallback((doc: string) => {
    return EditorState.create({
      doc,
      extensions: [
        basicSetup,
        sql({ dialect: StandardSQL, upperCaseKeywords: true }),
        bracketMatching(),
        highlightSelectionMatches(),
        autocompletion(),
        keymap.of([
          ...defaultKeymap,
          ...searchKeymap,
          indentWithTab,
          { key: 'Ctrl-Enter', mac: 'Cmd-Enter', run: () => { onExecuteRef.current?.(); return true } },
        ]),
        cmPlaceholder(placeholder || 'SELECT ...'),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        }),
        EditorState.readOnly.of(!!readOnly),
        EditorView.lineWrapping,
        ...(isDark ? [oneDark] : []),
        EditorView.theme({
          '&': { fontSize: '13px', height: '100%' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'Cascadia Code', 'Fira Code', monospace" },
          '.cm-content': { minHeight: '200px' },
        }),
      ],
    })
  }, [isDark, readOnly, placeholder])

  useEffect(() => {
    if (!containerRef.current) return
    const view = new EditorView({
      state: createState(value),
      parent: containerRef.current,
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Recreate editor when theme changes
  useEffect(() => {
    const view = viewRef.current
    if (!view || !containerRef.current) return
    const currentDoc = view.state.doc.toString()
    view.setState(createState(currentDoc))
  }, [isDark, createState])

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      })
    }
  }, [value])

  return <div ref={containerRef} className={`overflow-hidden rounded-lg border border-surface-200 dark:border-dark-surface-100 ${className || ''}`} />
}
