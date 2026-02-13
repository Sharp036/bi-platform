import api from '@/api/client';

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  roles: RoleListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleListItem {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
}

export interface RoleDetail {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionItem[];
  userCount: number;
}

export interface PermissionItem {
  id: number;
  code: string;
  description: string | null;
}

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  objectType: string | null;
  objectId: number | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ═══════════════════════════════════════════
//  User Admin API
// ═══════════════════════════════════════════

export const adminUserApi = {
  list: (page = 0, size = 20, search?: string) =>
    api.get<PageResponse<AdminUser>>('/admin/users', {
      params: { page, size, search }
    }).then(r => r.data),

  get: (id: number) =>
    api.get<AdminUser>(`/admin/users/${id}`).then(r => r.data),

  create: (data: {
    username: string; email: string; password: string;
    displayName?: string; roleIds?: number[]; isActive?: boolean;
  }) => api.post<AdminUser>('/admin/users', data).then(r => r.data),

  update: (id: number, data: {
    email?: string; displayName?: string;
    isActive?: boolean; roleIds?: number[];
  }) => api.put<AdminUser>(`/admin/users/${id}`, data).then(r => r.data),

  resetPassword: (id: number, newPassword: string) =>
    api.post(`/admin/users/${id}/reset-password`, { newPassword }).then(r => r.data),

  toggleActive: (id: number) =>
    api.post<AdminUser>(`/admin/users/${id}/toggle-active`).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/admin/users/${id}`).then(r => r.data),
};

// ═══════════════════════════════════════════
//  Role Admin API
// ═══════════════════════════════════════════

export const adminRoleApi = {
  list: () =>
    api.get<RoleListItem[]>('/admin/roles').then(r => r.data),

  get: (id: number) =>
    api.get<RoleDetail>(`/admin/roles/${id}`).then(r => r.data),

  permissions: () =>
    api.get<PermissionItem[]>('/admin/roles/permissions').then(r => r.data),

  create: (data: { name: string; description?: string; permissionIds?: number[] }) =>
    api.post<RoleDetail>('/admin/roles', data).then(r => r.data),

  update: (id: number, data: { name?: string; description?: string; permissionIds?: number[] }) =>
    api.put<RoleDetail>(`/admin/roles/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/admin/roles/${id}`).then(r => r.data),
};

// ═══════════════════════════════════════════
//  Audit Log API
// ═══════════════════════════════════════════

export const auditLogApi = {
  list: (page = 0, size = 50, filters?: {
    userId?: number; action?: string; objectType?: string;
  }) => api.get<PageResponse<AuditLogEntry>>('/admin/audit', {
    params: { page, size, ...filters }
  }).then(r => r.data),
};

// ═══════════════════════════════════════════
//  Profile API
// ═══════════════════════════════════════════

export const profileApi = {
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/profile/change-password', { currentPassword, newPassword }).then(r => r.data),
};
