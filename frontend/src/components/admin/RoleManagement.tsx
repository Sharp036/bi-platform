import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  adminRoleApi,
  RoleListItem, RoleDetail, PermissionItem
} from '@/api/admin';

const RoleManagement: React.FC = () => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPermIds, setFormPermIds] = useState<number[]>([]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        adminRoleApi.list(),
        adminRoleApi.permissions()
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (e: any) {
      setError(e.response?.data?.message || t('admin.failed_load_roles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const selectRole = async (id: number) => {
    try {
      const detail = await adminRoleApi.get(id);
      setSelectedRole(detail);
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.failed_to_load'));
    }
  };

  const handleCreate = () => {
    setEditMode(false);
    setFormName('');
    setFormDesc('');
    setFormPermIds([]);
    setShowModal(true);
  };

  const handleEdit = () => {
    if (!selectedRole) return;
    setEditMode(true);
    setFormName(selectedRole.name);
    setFormDesc(selectedRole.description || '');
    setFormPermIds(selectedRole.permissions.map(p => p.id));
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editMode && selectedRole) {
        await adminRoleApi.update(selectedRole.id, {
          name: formName,
          description: formDesc || undefined,
          permissionIds: formPermIds
        });
      } else {
        await adminRoleApi.create({
          name: formName,
          description: formDesc || undefined,
          permissionIds: formPermIds
        });
      }
      setShowModal(false);
      loadRoles();
      if (selectedRole) selectRole(selectedRole.id);
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.operation_failed'));
    }
  };

  const handleDelete = async (role: RoleListItem | RoleDetail) => {
    if (role.isSystem) return;
    if (!confirm(t('admin.delete_role_confirm', { name: role.name }))) return;
    try {
      await adminRoleApi.delete(role.id);
      if (selectedRole?.id === role.id) setSelectedRole(null);
      loadRoles();
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.failed_to_delete'));
    }
  };

  const togglePerm = (permId: number) => {
    setFormPermIds(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  // Group permissions by prefix (DATASOURCE_, REPORT_, etc.)
  const permGroups = permissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
    const prefix = p.code.split('_')[0] || 'OTHER';
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(p);
    return acc;
  }, {});

  const getRoleDescription = (roleName: string, fallback?: string | null) => {
    return t(`admin.role_description.${roleName}`, {
      defaultValue: fallback || t('admin.no_description')
    });
  };

  const getPermissionDescription = (permCode: string, fallback?: string | null) => {
    return t(`admin.permission_description.${permCode}`, {
      defaultValue: fallback || ''
    });
  };

  return (
    <div className="admin-roles">
      <div className="admin-header">
        <h2>{t('admin.role_management')}</h2>
        <button className="btn btn-primary" onClick={handleCreate}>{t('admin.new_role')}</button>
      </div>

      {error && (
        <div className="alert alert-error" onClick={() => setError('')}>{error}</div>
      )}

      <div className="roles-layout">
        {/* Role List */}
        <div className="roles-list">
          {loading ? <p>{t('common.loading')}</p> : roles.map(role => (
            <div
              key={role.id}
              className={`role-card ${selectedRole?.id === role.id ? 'selected' : ''}`}
              onClick={() => selectRole(role.id)}
            >
              <div className="role-card-header">
                <span className={`badge badge-${role.name.toLowerCase()}`}>{role.name}</span>
                {role.isSystem && <small className="system-tag">{t('admin.system_badge')}</small>}
              </div>
              <p className="role-desc">{getRoleDescription(role.name, role.description)}</p>
              <small>{t('admin.permissions_count', { count: role.permissionCount })}</small>
            </div>
          ))}
        </div>

        {/* Role Detail */}
        <div className="role-detail">
          {selectedRole ? (
            <>
              <div className="detail-header">
                <h3>{selectedRole.name}</h3>
                <div>
                  {!selectedRole.isSystem && (
                    <>
                      <button className="btn btn-sm" onClick={handleEdit}>✏️ {t('common.edit')}</button>
                      <button className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(selectedRole)}>🗑️ {t('common.delete')}</button>
                    </>
                  )}
                </div>
              </div>
              <p>{getRoleDescription(selectedRole.name, selectedRole.description)}</p>
              <p className="user-count">{t('admin.users_assigned', { count: selectedRole.userCount })}</p>

              <h4>{t('admin.permissions')} ({selectedRole.permissions.length})</h4>
              <div className="perm-list">
                {selectedRole.permissions.map(p => (
                  <div key={p.id} className="perm-item">
                    <code>{p.code}</code>
                    <small>{getPermissionDescription(p.code, p.description)}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>{t('admin.no_roles_found')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h3>{editMode ? t('admin.edit_role', { name: selectedRole?.name }) : t('admin.create_role')}</h3>
            <div className="form-group">
              <label>{t('admin.role_name')}</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. DATA_ANALYST"
              />
            </div>
            <div className="form-group">
              <label>{t('common.description')}</label>
              <input
                type="text"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder={t('admin.role_description_placeholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('admin.permissions')}</label>
              <div className="perm-grid">
                {Object.entries(permGroups).map(([group, perms]) => (
                  <div key={group} className="perm-group">
                    <h5>{group}</h5>
                    {perms.map(p => (
                      <label key={p.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formPermIds.includes(p.id)}
                          onChange={() => togglePerm(p.id)}
                        />
                        <span>{p.code}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSubmit}
                disabled={!formName.trim()}>
                {editMode ? t('common.save') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
