import React, { useState, useEffect } from 'react';
import {
  adminRoleApi,
  RoleListItem, RoleDetail, PermissionItem
} from '@/api/admin';

const RoleManagement: React.FC = () => {
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
      setError(e.response?.data?.message || 'Failed to load roles');
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
      setError(e.response?.data?.message || 'Failed to load role');
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
      setError(e.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (role: RoleListItem) => {
    if (role.isSystem) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try {
      await adminRoleApi.delete(role.id);
      if (selectedRole?.id === role.id) setSelectedRole(null);
      loadRoles();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to delete role');
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

  return (
    <div className="admin-roles">
      <div className="admin-header">
        <h2>Role Management</h2>
        <button className="btn btn-primary" onClick={handleCreate}>+ New Role</button>
      </div>

      {error && (
        <div className="alert alert-error" onClick={() => setError('')}>{error}</div>
      )}

      <div className="roles-layout">
        {/* Role List */}
        <div className="roles-list">
          {loading ? <p>Loading...</p> : roles.map(role => (
            <div
              key={role.id}
              className={`role-card ${selectedRole?.id === role.id ? 'selected' : ''}`}
              onClick={() => selectRole(role.id)}
            >
              <div className="role-card-header">
                <span className={`badge badge-${role.name.toLowerCase()}`}>{role.name}</span>
                {role.isSystem && <small className="system-tag">System</small>}
              </div>
              <p className="role-desc">{role.description || 'No description'}</p>
              <small>{role.permissionCount} permissions</small>
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
                      <button className="btn btn-sm" onClick={handleEdit}>✏️ Edit</button>
                      <button className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(selectedRole)}>🗑️ Delete</button>
                    </>
                  )}
                </div>
              </div>
              <p>{selectedRole.description || 'No description'}</p>
              <p className="user-count">{selectedRole.userCount} user(s) assigned</p>

              <h4>Permissions ({selectedRole.permissions.length})</h4>
              <div className="perm-list">
                {selectedRole.permissions.map(p => (
                  <div key={p.id} className="perm-item">
                    <code>{p.code}</code>
                    <small>{p.description}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a role to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h3>{editMode ? 'Edit Role' : 'Create New Role'}</h3>
            <div className="form-group">
              <label>Role Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. DATA_ANALYST"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="form-group">
              <label>Permissions</label>
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
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}
                disabled={!formName.trim()}>
                {editMode ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
