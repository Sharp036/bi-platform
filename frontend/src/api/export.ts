import api from './client'
import type { ExportStatusResponse, EmailDeliveryResponse, EmbedToken } from '@/types'

export const exportApi = {
  // Direct download (returns blob)
  download: (reportId: number, format: string, parameters?: Record<string, unknown>) =>
    api.post(`/export/reports/${reportId}`, { format, parameters }, { responseType: 'blob' })
      .then(r => r.data),

  // Export & save (returns download URL)
  exportAndSave: (reportId: number, format: string, parameters?: Record<string, unknown>) =>
    api.post<ExportStatusResponse>(`/export/reports/${reportId}/save`, { format, parameters })
      .then(r => r.data),

  // Email report
  emailReport: (reportId: number, data: {
    recipients: string[]; format?: string; subject?: string; body?: string;
    parameters?: Record<string, unknown>
  }) =>
    api.post<EmailDeliveryResponse>(`/export/reports/${reportId}/email`, {
      reportId, ...data
    }).then(r => r.data),
}

export const embedApi = {
  create: (data: { reportId: number; label?: string; parameters?: Record<string, unknown>; expiresInDays?: number; allowedDomains?: string }) =>
    api.post<EmbedToken>('/embed-tokens', data).then(r => r.data),

  listForReport: (reportId: number) =>
    api.get<EmbedToken[]>(`/embed-tokens/report/${reportId}`).then(r => r.data),

  revoke: (id: number) =>
    api.delete(`/embed-tokens/${id}`),
}
