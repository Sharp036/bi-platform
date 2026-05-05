import { useEffect } from 'react'
import type { ChangeEvent } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const VALID = /^-?\d*\.?\d*$/

function normalize(raw: string): string {
  return raw.replace(/,/g, '.').replace(/\s/g, '')
}

export default function NumberInput({ value, onChange, placeholder, className, disabled }: Props) {
  useEffect(() => {
    const normalized = normalize(value)
    if (normalized !== value) onChange(normalized)
  }, [value, onChange])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = normalize(e.target.value)
    if (next === '' || next === '-' || VALID.test(next)) {
      onChange(next)
    }
  }

  const handleBlur = () => {
    if (value === '-' || value === '.' || value === '-.') {
      onChange('')
    } else if (value.endsWith('.')) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  )
}
