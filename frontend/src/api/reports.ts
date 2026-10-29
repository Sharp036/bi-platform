import api from './client'
import type { Report, ReportListItem, PageResponse, RenderReportResponse, RenderedWidget, Schedule, Widget } from '@/types'

// Widgets without data, as on the server: one request for all of them
const NON_DATA_WIDGETS = new Set(['IMAGE', 'BUTTON', 'WEBPAGE', 'SPACER', 'DIVIDER'])
const RENDER_CONCURRENCY = 4

async function settleWithLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = { status: 'fulfilled', value: await run(items[i]) }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export const reportApi = {
  list: (params?: { status?: string; page?: number; size?: number }) =>
    api.get<PageResponse<ReportListItem>>('/reports', { params }).then(r => r.data),

  get: (idOrSlug: number | string) =>
    api.get<Report>(`/reports/${idOrSlug}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<Report>('/reports', data).then(r => r.data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<Report>(`/reports/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/reports/${id}`),

  publish: (id: number) =>
    api.post<Report>(`/reports/${id}/publish`).then(r => r.data),

  unpublish: (id: number) =>
    api.post<Report>(`/reports/${id}/unpublish`).then(r => r.data),

  archive: (id: number) =>
    api.post<Report>(`/reports/${id}/archive`).then(r => r.data),

  duplicate: (id: number, name?: string) =>
    api.post<Report>(`/reports/${id}/duplicate`, null, { params: { name } }).then(r => r.data),

  render: (id: number, parameters?: Record<string, unknown>, widgetIds?: number[]) =>
    api.post<RenderReportResponse>(`/reports/${id}/render`, { parameters, widgetIds }, { retryable: true }).then(r => r.data),

  // Each data widget is requested separately, a few at a time: a lost response or a failed request
  // costs one widget, which then shows failedText or the server message instead of its data.
  renderByWidget: async (id: number, parameters: Record<string, unknown>, widgets: Widget[], failedText: string): Promise<RenderReportResponse> => {
    const startMs = Date.now()
    const visible = widgets
      .filter(w => w.isVisible !== false && (w.id ?? w.widgetId) !== undefined)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? a.widgetId ?? 0) - (b.id ?? b.widgetId ?? 0))
    const ids = visible.map(w => (w.id ?? w.widgetId) as number)
    const nonData = visible.filter(w => NON_DATA_WIDGETS.has(w.widgetType)).map(w => (w.id ?? w.widgetId) as number)
    const groups = [...(nonData.length > 0 ? [nonData] : []), ...ids.filter(wid => !nonData.includes(wid)).map(wid => [wid])]
    const results = await settleWithLimit(groups, RENDER_CONCURRENCY, group => reportApi.render(id, parameters, group))
    const first = results.find((r): r is PromiseFulfilledResult<RenderReportResponse> => r.status === 'fulfilled')
    if (!first && results.length > 0) throw (results[0] as PromiseRejectedResult).reason
    const rendered = new Map<number, RenderedWidget>()
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        r.value.widgets.forEach(w => rendered.set(w.widgetId, w))
        return
      }
      const message = (r.reason as { response?: { data?: { message?: string } } })?.response?.data?.message
      for (const wid of groups[i]) {
        const w = visible.find(v => (v.id ?? v.widgetId) === wid)!
        rendered.set(wid, {
          widgetId: wid, widgetType: w.widgetType, title: w.title, body: w.body,
          chartConfig: w.chartConfig, position: w.position, style: w.style,
          error: message || failedText,
        })
      }
    })
    return {
      reportId: id,
      reportName: first?.value.reportName ?? '',
      parameters: first?.value.parameters ?? parameters,
      widgets: ids.filter(wid => rendered.has(wid)).map(wid => rendered.get(wid)!),
      executionMs: Date.now() - startMs,
    }
  },

  // Widgets
  getWidgets: (reportId: number) =>
    api.get(`/reports/${reportId}/widgets`).then(r => r.data),

  addWidget: (reportId: number, data: Record<string, unknown>) =>
    api.post(`/reports/${reportId}/widgets`, data).then(r => r.data),

  setParameters: (reportId: number, params: Array<Record<string, unknown>>) =>
    api.put(`/reports/${reportId}/parameters`, params).then(r => r.data),

  deleteWidget: (widgetId: number) =>
    api.delete(`/reports/widgets/${widgetId}`),

  updateWidget: (widgetId: number, data: Record<string, unknown>) =>
    api.put(`/reports/widgets/${widgetId}`, data).then(r => r.data),

  duplicateWidget: (widgetId: number) =>
    api.post(`/reports/widgets/${widgetId}/duplicate`).then(r => r.data as Record<string, unknown>),

  // Parameters
  getParameters: (reportId: number) =>
    api.get(`/reports/${reportId}/parameters`).then(r => r.data),

  // Snapshots
  getSnapshots: (reportId: number) =>
    api.get(`/reports/${reportId}/snapshots`).then(r => r.data),

  createSnapshot: (reportId: number, parameters?: Record<string, unknown>) =>
    api.post(`/reports/${reportId}/snapshot`, { parameters }).then(r => r.data),
}

export const scheduleApi = {
  list: () =>
    api.get<Schedule[]>('/schedules').then(r => r.data),

  listForReport: (reportId: number) =>
    api.get<Schedule[]>(`/schedules/report/${reportId}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<Schedule>('/schedules', data).then(r => r.data),

  toggle: (id: number) =>
    api.post<Schedule>(`/schedules/${id}/toggle`).then(r => r.data),

  executeNow: (id: number) =>
    api.post(`/schedules/${id}/execute`).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/schedules/${id}`),
}
