import api from './client'

export interface ApiKey {
  id: number; name: string; keyPrefix: string
  createdAt: string; expiresAt?: string; lastUsedAt?: string
}

export interface ApiKeyCreated {
  id: number; name: string; keyPrefix: string
  key: string; createdAt: string; expiresAt?: string
}

export const apiKeyApi = {
  list: () =>
    api.get<ApiKey[]>('/api-keys').then(r => r.data),

  create: (name: string, expiresAt?: string) =>
    api.post<ApiKeyCreated>('/api-keys', { name, expiresAt }).then(r => r.data),

  revoke: (id: number) =>
    api.delete(`/api-keys/${id}`),
}
