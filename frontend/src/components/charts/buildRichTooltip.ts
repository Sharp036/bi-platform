import type { TooltipConfigItem, TooltipFieldDef } from '@/api/visualization'

/**
 * Build an ECharts tooltip configuration from TooltipConfigItem.
 * Returns tooltip option to merge into chart options.
 */
export function buildRichTooltip(config: TooltipConfigItem): Record<string, any> {
  if (!config.isEnabled) return { tooltip: { show: false } }

  // Custom HTML template
  if (config.htmlTemplate) {
    return {
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          let html = config.htmlTemplate!
          // Replace placeholders: {name}, {value}, {seriesName}, {field_name}
          html = html.replace(/\{name\}/g, p.name || '')
          html = html.replace(/\{value\}/g, String(p.value ?? ''))
          html = html.replace(/\{seriesName\}/g, p.seriesName || '')
          // Replace data fields
          if (p.data && typeof p.data === 'object') {
            Object.entries(p.data).forEach(([k, v]) => {
              html = html.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''))
            })
          }
          return html
        },
      },
    }
  }

  // Structured rich tooltip
  return {
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params]
        if (items.length === 0) return ''

        const firstItem = items[0]
        const parts: string[] = []

        // Title
        if (config.showTitle) {
          const titleVal = config.titleField
            ? getFieldValue(firstItem, config.titleField)
            : firstItem.name
          parts.push(`<div style="font-weight:600;margin-bottom:4px;font-size:13px">${titleVal ?? ''}</div>`)
        }

        // Configured fields
        if (config.fields.length > 0) {
          items.forEach(item => {
            config.fields.forEach(fieldDef => {
              const val = getFieldValue(item, fieldDef.field)
              if (val === undefined || val === null) return
              const formatted = formatValue(val, fieldDef)
              const label = fieldDef.label || fieldDef.field
              const colorDot = fieldDef.color || item.color || '#666'
              parts.push(
                `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">` +
                `<span style="width:8px;height:8px;border-radius:50%;background:${colorDot};display:inline-block"></span>` +
                `<span style="color:#888;font-size:11px">${label}:</span>` +
                `<span style="font-weight:500;font-size:12px">${formatted}</span>` +
                `</div>`
              )
            })
          })
        } else {
          // Default: show all series
          items.forEach(item => {
            parts.push(
              `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">` +
              `<span style="width:8px;height:8px;border-radius:50%;background:${item.color || '#666'};display:inline-block"></span>` +
              `<span style="color:#888;font-size:11px">${item.seriesName}:</span>` +
              `<span style="font-weight:500;font-size:12px">${item.value ?? '-'}</span>` +
              `</div>`
            )
          })
        }

        // Sparkline placeholder (mini bar chart)
        if (config.showSparkline && config.sparklineField) {
          parts.push(
            `<div style="margin-top:6px;padding-top:4px;border-top:1px solid #eee;font-size:10px;color:#aaa">` +
            `📊 ${config.sparklineField} trend</div>`
          )
        }

        return `<div style="padding:2px 0">${parts.join('')}</div>`
      },
    },
  }
}

function getFieldValue(item: any, field: string): any {
  // Try direct data access
  if (item.data && typeof item.data === 'object' && !Array.isArray(item.data)) {
    if (field in item.data) return item.data[field]
  }
  // Try item props
  if (field === 'value') return item.value
  if (field === 'name') return item.name
  if (field === 'seriesName') return item.seriesName
  return undefined
}

function formatValue(val: any, def: TooltipFieldDef): string {
  const prefix = def.prefix || ''
  const suffix = def.suffix || ''
  const num = typeof val === 'number' ? val : parseFloat(String(val))

  if (isNaN(num)) return `${prefix}${val}${suffix}`

  switch (def.format) {
    case 'number':
      return `${prefix}${num.toLocaleString()}${suffix}`
    case 'percent':
      return `${prefix}${(num * 100).toFixed(1)}%${suffix}`
    case 'currency':
      return `${prefix}$${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}${suffix}`
    case 'compact': {
      if (num >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(1)}M${suffix}`
      if (num >= 1_000) return `${prefix}${(num / 1_000).toFixed(1)}K${suffix}`
      return `${prefix}${num}${suffix}`
    }
    default:
      return `${prefix}${val}${suffix}`
  }
}
