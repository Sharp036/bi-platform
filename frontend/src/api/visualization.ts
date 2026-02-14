import api from '@/api/client'

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface AnnotationItem {
  id: number; widgetId: number; annotationType: string
  axis: string; value: number | null; valueEnd: number | null
  label: string | null; color: string | null
  lineStyle: string | null; lineWidth: number | null
  opacity: number | null; fillColor: string | null; fillOpacity: number | null
  position: string | null; fontSize: number | null
  isVisible: boolean; sortOrder: number
  config: Record<string, unknown>; createdAt: string
}

export interface TooltipFieldDef {
  field: string; label?: string; format?: string
  color?: string; prefix?: string; suffix?: string
}

export interface TooltipConfigItem {
  id: number; widgetId: number; isEnabled: boolean
  showTitle: boolean; titleField: string | null
  fields: TooltipFieldDef[]; showSparkline: boolean
  sparklineField: string | null; htmlTemplate: string | null
  config: Record<string, unknown>; createdAt: string
}

export interface ContainerItem {
  id: number; reportId: number; containerType: string
  name: string | null; childWidgetIds: number[]
  activeTab: number; autoDistribute: boolean
  config: Record<string, unknown>; sortOrder: number; createdAt: string
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

export const vizApi = {
  // Annotations
  getAnnotations: (widgetId: number) =>
    api.get<AnnotationItem[]>(`/visualization/annotations/widget/${widgetId}`).then(r => r.data),

  getAnnotationsForWidgets: (widgetIds: number[]) =>
    api.get<Record<number, AnnotationItem[]>>('/visualization/annotations/widgets', { params: { widgetIds } }).then(r => r.data),

  createAnnotation: (data: Partial<AnnotationItem> & { widgetId: number }) =>
    api.post<AnnotationItem>('/visualization/annotations', data).then(r => r.data),

  updateAnnotation: (id: number, data: Partial<AnnotationItem> & { widgetId: number }) =>
    api.put<AnnotationItem>(`/visualization/annotations/${id}`, data).then(r => r.data),

  deleteAnnotation: (id: number) =>
    api.delete(`/visualization/annotations/${id}`),

  // Tooltips
  getTooltip: (widgetId: number) =>
    api.get<TooltipConfigItem | null>(`/visualization/tooltips/widget/${widgetId}`).then(r => r.data),

  getTooltips: (widgetIds: number[]) =>
    api.get<Record<number, TooltipConfigItem>>('/visualization/tooltips/widgets', { params: { widgetIds } }).then(r => r.data),

  saveTooltip: (data: { widgetId: number; isEnabled?: boolean; showTitle?: boolean; titleField?: string; fields?: TooltipFieldDef[]; showSparkline?: boolean; sparklineField?: string; htmlTemplate?: string }) =>
    api.post<TooltipConfigItem>('/visualization/tooltips', data).then(r => r.data),

  deleteTooltip: (widgetId: number) =>
    api.delete(`/visualization/tooltips/widget/${widgetId}`),

  // Containers
  getContainers: (reportId: number) =>
    api.get<ContainerItem[]>(`/visualization/containers/${reportId}`).then(r => r.data),

  createContainer: (data: { reportId: number; containerType: string; name?: string; childWidgetIds: number[]; activeTab?: number }) =>
    api.post<ContainerItem>('/visualization/containers', data).then(r => r.data),

  updateContainer: (id: number, data: { reportId: number; containerType: string; name?: string; childWidgetIds: number[]; activeTab?: number }) =>
    api.put<ContainerItem>(`/visualization/containers/${id}`, data).then(r => r.data),

  deleteContainer: (id: number) =>
    api.delete(`/visualization/containers/${id}`),
}
