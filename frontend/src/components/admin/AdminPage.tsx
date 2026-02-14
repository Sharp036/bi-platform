import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import AuditLog from './AuditLog';
import './admin.css';

type AdminTab = 'users' | 'roles' | 'audit';

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  return (
    <div className="admin-page">
      <div className="admin-nav">
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          {t('admin.users_tab')}
        </button>
        <button
          className={`admin-tab ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          {t('admin.roles_tab')}
        </button>
        <button
          className={`admin-tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          {t('admin.audit_tab')}
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'roles' && <RoleManagement />}
        {activeTab === 'audit' && <AuditLog />}
      </div>
    </div>
  );
};

export default AdminPage;
