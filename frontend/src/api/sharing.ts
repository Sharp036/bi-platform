import api from '@/api/client';

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface ShareEntry {
  id: number;
  objectType: string;
  objectId: number;
  userId: number | null;
  username: string | null;
  userDisplayName: string | null;
  roleId: number | null;
  roleName: string | null;
  accessLevel: string;
  createdAt: string;
}

export interface SharedObjectItem {
  objectType: string;
  objectId: number;
  objectName: string;
  accessLevel: string;
  sharedBy: string | null;
  sharedAt: string;
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

export const sharingApi = {
  /** Get all shares for an object */
  getShares: (objectType: string, objectId: number) =>
    api.get<ShareEntry[]>(`/sharing/${objectType}/${objectId}`).then(r => r.data),

  /** Grant access */
  grant: (data: {
    objectType: string; objectId: number;
    userId?: number; roleId?: number; accessLevel: string;
  }) => api.post<ShareEntry>('/sharing/grant', data).then(r => r.data),

  /** Bulk grant */
  bulkGrant: (data: {
    objectType: string; objectId: number;
    shares: Array<{ userId?: number; roleId?: number; accessLevel: string }>;
  }) => api.post<ShareEntry[]>('/sharing/bulk-grant', data).then(r => r.data),

  /** Revoke access */
  revoke: (data: {
    objectType: string; objectId: number;
    userId?: number; roleId?: number;
  }) => api.post('/sharing/revoke', data).then(r => r.data),

  /** Objects shared with me */
  sharedWithMe: () =>
    api.get<SharedObjectItem[]>('/sharing/shared-with-me').then(r => r.data),

  /** My access level on object */
  myAccess: (objectType: string, objectId: number) =>
    api.get<{ accessLevel: string | null }>(`/sharing/${objectType}/${objectId}/my-access`).then(r => r.data),
};
