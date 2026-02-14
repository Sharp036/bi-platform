import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  adminUserApi, adminRoleApi,
  AdminUser, RoleListItem, PageResponse
} from '@/api/admin';

interface UserFormData {
  username: string;
  email: string;
  password: string;
  displayName: string;
  roleIds: number[];
  isActive: boolean;
}

const emptyForm: UserFormData = {
  username: '', email: '', password: '',
  displayName: '', roleIds: [], isActive: true
};

const UserManagement: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminUserApi.list(page, 20, search || undefined);
      setUsers(data.content);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.response?.data?.message || t('admin.failed_load_users'));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
    adminRoleApi.list().then(setRoles).catch(() => {});
  }, [loadUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      displayName: user.displayName || '',
      roleIds: user.roles.map(r => r.id),
      isActive: user.isActive
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        await adminUserApi.update(editingUser.id, {
          email: form.email,
          displayName: form.displayName || undefined,
          isActive: form.isActive,
          roleIds: form.roleIds
        });
      } else {
        await adminUserApi.create({
          username: form.username,
          email: form.email,
          password: form.password,
          displayName: form.displayName || undefined,
          roleIds: form.roleIds,
          isActive: form.isActive
        });
      }
      setShowModal(false);
      loadUsers();
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.operation_failed'));
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await adminUserApi.toggleActive(user.id);
      loadUsers();
    } catch (e: any) {
      setError(e.response?.data?.message || t('admin.failed_toggle'));
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(t('admin.delete_user_confirm', { name: user.username }))) return;
    try {
      await adminUserApi.delete(user.id);
      loadUsers();
    } catch (e: any) {
      setError(e.response?.data?.message || t('admin.failed_delete'));
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !newPassword) return;
    try {
      await adminUserApi.resetPassword(resetUserId, newPassword);
      setResetUserId(null);
      setNewPassword('');
    } catch (e: any) {
      setError(e.response?.data?.message || t('admin.failed_reset'));
    }
  };

  const toggleRole = (roleId: number) => {
    setForm(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId]
    }));
  };

  return (
    <div className="admin-users">
      <div className="admin-header">
        <h2>{t('admin.user_management')}</h2>
        <button className="btn btn-primary" onClick={handleCreate}>
          {t('admin.new_user')}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" onClick={() => setError('')}>
          {error}
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          placeholder={t('admin.search_users')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('admin.col.username')}</th>
              <th>{t('admin.col.email')}</th>
              <th>{t('admin.col.display_name')}</th>
              <th>{t('admin.col.roles')}</th>
              <th>{t('admin.col.status')}</th>
              <th>{t('admin.col.created')}</th>
              <th>{t('admin.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center">{t('common.loading')}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center">{t('admin.no_users')}</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className={!user.isActive ? 'row-inactive' : ''}>
                <td className="font-mono">{user.username}</td>
                <td>{user.email}</td>
                <td>{user.displayName || '—'}</td>
                <td>
                  {user.roles.map(r => (
                    <span key={r.id} className={`badge badge-${r.name.toLowerCase()}`}>
                      {r.name}
                    </span>
                  ))}
                </td>
                <td>
                  <span className={`status-dot ${user.isActive ? 'active' : 'inactive'}`} />
                  {user.isActive ? t('common.status.active') : t('common.status.disabled')}
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="actions">
                  <button className="btn btn-sm" onClick={() => handleEdit(user)} title="Edit">
                    ✏️
                  </button>
                  <button className="btn btn-sm" onClick={() => {
                    setResetUserId(user.id);
                    setNewPassword('');
                  }} title="Reset password">
                    🔑
                  </button>
                  <button className="btn btn-sm" onClick={() => handleToggleActive(user)}
                    title={user.isActive ? t('admin.deactivate') : t('admin.activate')}>
                    {user.isActive ? '🚫' : '✅'}
                  </button>
                  {user.username !== 'admin' && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user)} title="Delete">
                      🗑️
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t('common.pagination.prev')}</button>
          <span>{t('common.pagination.page_of', { current: page + 1, total: totalPages })}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>{t('common.pagination.next')}</button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingUser ? t('admin.edit_user', { name: editingUser.username }) : t('admin.create_user')}</h3>
            <div className="form-group">
              <label>{t('admin.field.username')}</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                disabled={!!editingUser}
                placeholder="username"
              />
            </div>
            <div className="form-group">
              <label>{t('admin.field.email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            {!editingUser && (
              <div className="form-group">
                <label>{t('admin.field.password')}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={t('admin.password_placeholder')}
                />
              </div>
            )}
            <div className="form-group">
              <label>{t('admin.field.display_name')}</label>
              <input
                type="text"
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="form-group">
              <label>{t('admin.field.roles')}</label>
              <div className="checkbox-group">
                {roles.map(role => (
                  <label key={role.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <span className={`badge badge-${role.name.toLowerCase()}`}>{role.name}</span>
                    {role.isSystem && <small>{t('admin.system_role')}</small>}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                />
                {t('admin.field.active')}
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingUser ? t('admin.save_changes') : t('admin.create_user_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUserId !== null && (
        <div className="modal-overlay" onClick={() => setResetUserId(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <h3>{t('admin.reset_password')}</h3>
            <div className="form-group">
              <label>{t('admin.new_password')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={t('admin.password_placeholder')}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setResetUserId(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleResetPassword}
                disabled={newPassword.length < 6}>
                {t('admin.reset_password')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
