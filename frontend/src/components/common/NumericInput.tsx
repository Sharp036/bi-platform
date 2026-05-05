import { useEffect, useState } from 'react'
import NumberInput from './NumberInput'

interface Props {
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Number-typed wrapper around NumberInput. Keeps a local string state so
 * partial decimal input ("0.") survives parent re-renders, but emits typed
 * numbers (or undefined when cleared) to the parent. Use this anywhere a
 * `number` field in chartConfig / widget metadata is edited - it inherits
 * NumberInput's locale tolerance (accepts both comma and dot, normalizes
 * to dot internally).
 */
export default function NumericInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState<string>(() => value === undefined ? '' : String(value))

  useEffect(() => {
    const parsed = text === '' ? undefined : parseFloat(text)
    const sameAsProp =
      (parsed === undefined && value === undefined) ||
      (parsed !== undefined && Number.isFinite(parsed) && parsed === value)
    if (!sameAsProp) {
      setText(value === undefined ? '' : String(value))
    }
  }, [value, text])

  return (
    <NumberInput
      value={text}
      onChange={v => {
        setText(v)
        if (v === '' || v === '-' || v === '.' || v === '-.') {
          onChange(undefined)
          return
        }
        const n = parseFloat(v)
        if (Number.isFinite(n)) onChange(n)
      }}
      {...rest}
    />
  )
}
