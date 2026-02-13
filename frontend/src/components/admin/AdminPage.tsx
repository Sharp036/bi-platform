import React, { useState } from 'react';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import AuditLog from './AuditLog';
import './admin.css';

type AdminTab = 'users' | 'roles' | 'audit';

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  return (
    <div className="admin-page">
      <div className="admin-nav">
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
        <button
          className={`admin-tab ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          🛡️ Roles
        </button>
        <button
          className={`admin-tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          📋 Audit Log
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
