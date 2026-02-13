import api from '@/api/client'

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface TagDto {
  id: number
  name: string
  color: string | null
  usageCount: number
  createdAt: string
}

export interface ObjectTagDto {
  tagId: number
  tagName: string
  tagColor: string | null
}

export interface SearchResult {
  objectType: string
  objectId: number
  name: string
  description: string | null
  tags: ObjectTagDto[]
  updatedAt: string | null
  relevance: number
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

export const tagApi = {
  list: () =>
    api.get<TagDto[]>('/tags').then(r => r.data),

  search: (q: string) =>
    api.get<TagDto[]>('/tags/search', { params: { q } }).then(r => r.data),

  create: (name: string, color?: string) =>
    api.post<TagDto>('/tags', { name, color }).then(r => r.data),

  update: (id: number, data: { name?: string; color?: string }) =>
    api.put<TagDto>(`/tags/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/tags/${id}`),

  getObjectTags: (objectType: string, objectId: number) =>
    api.get<ObjectTagDto[]>(`/tags/object/${objectType}/${objectId}`).then(r => r.data),

  assign: (tagId: number, objectType: string, objectId: number) =>
    api.post<ObjectTagDto>('/tags/assign', { tagId, objectType, objectId }).then(r => r.data),

  setTags: (tagIds: number[], objectType: string, objectId: number) =>
    api.post<ObjectTagDto[]>('/tags/bulk', { tagIds, objectType, objectId }).then(r => r.data),

  removeTag: (objectType: string, objectId: number, tagId: number) =>
    api.delete(`/tags/object/${objectType}/${objectId}/${tagId}`),
}

export const searchApi = {
  search: (q: string, types?: string[], tags?: number[], limit = 20, offset = 0) =>
    api.get<SearchResponse>('/search', { params: { q, types, tags, limit, offset } }).then(r => r.data),
}
