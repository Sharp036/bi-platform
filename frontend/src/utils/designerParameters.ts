type DesignerParameterLike = {
  name: string
  paramType?: string
  defaultValue?: string
}

function resolveDynamicDefault(rawValue?: string): string {
  const raw = (rawValue || '').trim()
  if (!raw) return ''
  const token = raw.toLowerCase()
  const now = new Date()
  const toDate = (d: Date) => d.toISOString().slice(0, 10)

  if (token === 'today' || token === '__today__' || token === '${today}') return toDate(now)
  if (token === 'start_of_year' || token === '__start_of_year__' || token === '${start_of_year}') {
    return toDate(new Date(now.getFullYear(), 0, 1))
  }
  if (token === 'start_of_month' || token === '__start_of_month__' || token === '${start_of_month}') {
    return toDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }
  if (token === 'end_of_year' || token === '__end_of_year__' || token === '${end_of_year}') {
    return toDate(new Date(now.getFullYear(), 11, 31))
  }

  return raw
}

export function buildDesignerParameterValues(
  parameters: DesignerParameterLike[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {}

  parameters.forEach((p) => {
    const key = (p.name || '').trim()
    if (!key) return
    const resolved = resolveDynamicDefault(p.defaultValue)
    if (!resolved) {
      // Keep parameter key present to avoid backend "missing required parameter"
      // during design-time metadata loading.
      values[key] = null
      return
    }

    switch ((p.paramType || '').toUpperCase()) {
      case 'NUMBER':
        values[key] = Number(resolved)
        break
      case 'BOOLEAN':
        values[key] = resolved === 'true'
        break
      default:
        values[key] = resolved
    }
  })

  return values
}

export function mergeSqlParameterKeys(
  sql: string,
  values: Record<string, unknown>,
): Record<string, unknown> {
  if (!sql?.trim()) return values
  const next = { ...values }
  const re = /(^|[^:]):([a-zA-Z_][a-zA-Z0-9_]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const name = (m[2] || '').trim()
    if (!name) continue
    if (!(name in next)) next[name] = null
  }
  return next
}
