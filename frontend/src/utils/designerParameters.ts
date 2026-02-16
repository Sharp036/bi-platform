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
    const resolved = resolveDynamicDefault(p.defaultValue)
    if (!resolved) return

    switch ((p.paramType || '').toUpperCase()) {
      case 'NUMBER':
        values[p.name] = Number(resolved)
        break
      case 'BOOLEAN':
        values[p.name] = resolved === 'true'
        break
      default:
        values[p.name] = resolved
    }
  })

  return values
}

