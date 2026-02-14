import type { AnnotationItem } from '@/api/visualization'

/**
 * Convert annotation items into ECharts markLine / markArea / markPoint config
 * to merge into chart series options.
 */
export function buildAnnotationOptions(annotations: AnnotationItem[]) {
  const markLine: any[] = []
  const markArea: any[] = []

  annotations.forEach(ann => {
    if (!ann.isVisible) return

    if (ann.annotationType === 'LINE' && ann.value != null) {
      markLine.push({
        name: ann.label || '',
        [ann.axis === 'x' ? 'xAxis' : 'yAxis']: ann.value,
        lineStyle: {
          color: ann.color || '#ef4444',
          type: ann.lineStyle || 'solid',
          width: ann.lineWidth || 1.5,
          opacity: ann.opacity || 0.8,
        },
        label: {
          show: !!ann.label,
          formatter: ann.label || '',
          position: ann.position || 'end',
          fontSize: ann.fontSize || 12,
          color: ann.color || '#ef4444',
        },
      })
    }

    if (ann.annotationType === 'BAND' && ann.value != null && ann.valueEnd != null) {
      const coord = ann.axis === 'x' ? 'xAxis' : 'yAxis'
      markArea.push([
        {
          name: ann.label || '',
          [coord]: ann.value,
          itemStyle: {
            color: ann.fillColor || ann.color || '#ef4444',
            opacity: ann.fillOpacity || 0.1,
          },
          label: {
            show: !!ann.label,
            position: 'insideTop',
            fontSize: ann.fontSize || 11,
            color: ann.color || '#ef4444',
          },
        },
        { [coord]: ann.valueEnd },
      ])
    }

    if (ann.annotationType === 'TREND') {
      // Trend line is represented as a markLine with type = 'average' or linear regression
      markLine.push({
        name: ann.label || 'Trend',
        type: 'average',
        lineStyle: {
          color: ann.color || '#3b82f6',
          type: 'dashed',
          width: ann.lineWidth || 1,
          opacity: ann.opacity || 0.6,
        },
        label: {
          show: !!ann.label,
          formatter: ann.label || 'Avg',
          position: ann.position || 'end',
          fontSize: ann.fontSize || 11,
        },
      })
    }

    if (ann.annotationType === 'TEXT' && ann.value != null) {
      // Text annotation via markPoint
      markLine.push({
        name: ann.label || '',
        [ann.axis === 'x' ? 'xAxis' : 'yAxis']: ann.value,
        lineStyle: { width: 0, type: 'solid', opacity: 0 },
        label: {
          show: true,
          formatter: ann.label || '',
          position: ann.position || 'end',
          fontSize: ann.fontSize || 12,
          color: ann.color || '#64748b',
          backgroundColor: '#ffffff',
          padding: [2, 6],
          borderRadius: 3,
        },
      })
    }
  })

  const result: Record<string, any> = {}

  if (markLine.length > 0) {
    result.markLine = {
      silent: true,
      symbol: 'none',
      data: markLine,
    }
  }

  if (markArea.length > 0) {
    result.markArea = {
      silent: true,
      data: markArea,
    }
  }

  return result
}

/**
 * Merge annotation options into the first series of an ECharts option object.
 */
export function mergeAnnotationsIntoOption(option: any, annotations: AnnotationItem[]): any {
  if (!annotations || annotations.length === 0) return option

  const annotOpts = buildAnnotationOptions(annotations)
  if (!annotOpts.markLine && !annotOpts.markArea) return option

  const series = option.series
  if (!series || series.length === 0) return option

  // Merge into first series
  series[0] = {
    ...series[0],
    ...(annotOpts.markLine ? { markLine: annotOpts.markLine } : {}),
    ...(annotOpts.markArea ? { markArea: annotOpts.markArea } : {}),
  }

  return { ...option, series }
}
