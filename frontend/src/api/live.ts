import api from '@/api/client'

export const liveApi = {
  /** Manually push an update to all subscribers of a report */
  push: (reportId: number, payload?: Record<string, unknown>) =>
    api.post<{ reportId: number; subscribersNotified: number }>(`/live/push/${reportId}`, payload).then(r => r.data),

  /** Get active subscription stats */
  stats: () =>
    api.get<{ totalReports: number; totalSubscriptions: number; reports: Record<number, number> }>('/live/stats').then(r => r.data),

  /** Disconnect all subscribers for a report */
  disconnect: (reportId: number) =>
    api.delete(`/live/disconnect/${reportId}`),
}
