import api from '@/api/client'

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface FavoriteItem {
  id: number
  objectType: string
  objectId: number
  objectName: string
  isFavorite: boolean
  createdAt: string
}

export interface RecentItemDto {
  objectType: string
  objectId: number
  objectName: string
  viewedAt: string
  viewCount: number
  isFavorite: boolean
}

export interface FolderDto {
  id: number
  name: string
  parentId: number | null
  ownerId: number
  isShared: boolean
  icon: string | null
  color: string | null
  sortOrder: number
  itemCount: number
  children: FolderDto[]
  createdAt: string
  updatedAt: string
}

export interface FolderItemDto {
  id: number
  folderId: number
  objectType: string
  objectId: number
  objectName: string
  sortOrder: number
  addedAt: string
}

export interface WorkspaceOverview {
  favorites: FavoriteItem[]
  recentItems: RecentItemDto[]
  folders: FolderDto[]
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

export const workspaceApi = {
  overview: () =>
    api.get<WorkspaceOverview>('/workspace/overview').then(r => r.data),

  // Favorites
  toggleFavorite: (objectType: string, objectId: number) =>
    api.post<{ isFavorite: boolean }>('/workspace/favorites/toggle', { objectType, objectId }).then(r => r.data),

  getFavorites: (objectType?: string) =>
    api.get<FavoriteItem[]>('/workspace/favorites', { params: { objectType } }).then(r => r.data),

  isFavorite: (objectType: string, objectId: number) =>
    api.get<{ isFavorite: boolean }>(`/workspace/favorites/check/${objectType}/${objectId}`).then(r => r.data),

  // Recent
  trackView: (objectType: string, objectId: number) =>
    api.post('/workspace/recent/track', { objectType, objectId }),

  getRecent: (limit = 20) =>
    api.get<RecentItemDto[]>('/workspace/recent', { params: { limit } }).then(r => r.data),

  // Folders
  getFolderTree: () =>
    api.get<FolderDto[]>('/workspace/folders').then(r => r.data),

  createFolder: (data: { name: string; parentId?: number; icon?: string; color?: string }) =>
    api.post<FolderDto>('/workspace/folders', data).then(r => r.data),

  updateFolder: (id: number, data: { name?: string; parentId?: number; icon?: string; color?: string; isShared?: boolean }) =>
    api.put<FolderDto>(`/workspace/folders/${id}`, data).then(r => r.data),

  deleteFolder: (id: number) =>
    api.delete(`/workspace/folders/${id}`),

  getFolderContents: (id: number) =>
    api.get<FolderItemDto[]>(`/workspace/folders/${id}/items`).then(r => r.data),

  addToFolder: (folderId: number, objectType: string, objectId: number) =>
    api.post<FolderItemDto>(`/workspace/folders/${folderId}/items`, { objectType, objectId }).then(r => r.data),

  removeFromFolder: (folderId: number, objectType: string, objectId: number) =>
    api.delete(`/workspace/folders/${folderId}/items/${objectType}/${objectId}`),
}
