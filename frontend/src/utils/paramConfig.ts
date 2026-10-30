// Settings of a report parameter (config): the server keeps and sends them as a JSON string.
export function parseParamConfig(config: unknown): Record<string, unknown> {
  if (config && typeof config === 'object') return config as Record<string, unknown>
  if (typeof config !== 'string' || !config.trim()) return {}
  try {
    const parsed = JSON.parse(config)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// Group of the parameter on the filter panel: config.group, '' when none
export function paramGroup(config: unknown): string {
  const group = parseParamConfig(config).group
  return typeof group === 'string' ? group.trim() : ''
}

// The config as a JSON string with the group set, or without it when the group is blank
export function withParamGroup(config: unknown, group: string): string {
  const next = { ...parseParamConfig(config) }
  if (group.trim()) next.group = group
  else delete next.group
  return JSON.stringify(next)
}

// Consecutive parameters of the same group form one section of the panel
export function groupParameters<T extends { config?: unknown }>(parameters: T[]): Array<{ title: string; items: T[] }> {
  const sections: Array<{ title: string; items: T[] }> = []
  for (const p of parameters) {
    const title = paramGroup(p.config)
    const last = sections[sections.length - 1]
    if (last && last.title === title) last.items.push(p)
    else sections.push({ title, items: [p] })
  }
  return sections
}
