import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { auditLogApi, AuditLogEntry, PageResponse } from '@/api/admin';

const ACTION_COLORS: Record<string, string> = {
  USER_CREATE: '#22c55e',
  USER_UPDATE: '#3b82f6',
  USER_DELETE: '#ef4444',
  USER_PASSWORD_RESET: '#f59e0b',
  USER_ACTIVATE: '#22c55e',
  USER_DEACTIVATE: '#ef4444',
  ROLE_CREATE: '#8b5cf6',
  ROLE_UPDATE: '#8b5cf6',
  ROLE_DELETE: '#ef4444',
  PASSWORD_CHANGE: '#f59e0b',
  LOGIN: '#6b7280',
};

const AuditLog: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterObjectType, setFilterObjectType] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditLogApi.list(page, 50, {
        action: filterAction || undefined,
        objectType: filterObjectType || undefined,
      });
      setEntries(data.content);
      setTotalPages(data.totalPages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterObjectType]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatDetails = (details: Record<string, unknown>) => {
    if (!details || Object.keys(details).length === 0) return '—';
    return Object.entries(details)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
  };

  return (
    <div className="admin-audit">
      <div className="admin-header">
        <h2>{t('admin.audit_log')}</h2>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
          <option value="">{t('admin.audit.all_actions')}</option>
          <option value="USER_CREATE">User Created</option>
          <option value="USER_UPDATE">User Updated</option>
          <option value="USER_DELETE">User Deleted</option>
          <option value="USER_PASSWORD_RESET">Password Reset</option>
          <option value="USER_ACTIVATE">User Activated</option>
          <option value="USER_DEACTIVATE">User Deactivated</option>
          <option value="ROLE_CREATE">Role Created</option>
          <option value="ROLE_UPDATE">Role Updated</option>
          <option value="ROLE_DELETE">Role Deleted</option>
          <option value="PASSWORD_CHANGE">Password Changed</option>
          <option value="LOGIN">Login</option>
        </select>
        <select value={filterObjectType} onChange={e => { setFilterObjectType(e.target.value); setPage(0); }}>
          <option value="">{t('admin.audit.all_types')}</option>
          <option value="USER">User</option>
          <option value="ROLE">Role</option>
          <option value="DATASOURCE">Data Source</option>
          <option value="REPORT">Report</option>
          <option value="DASHBOARD">Dashboard</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('admin.audit.timestamp')}</th>
              <th>{t('admin.audit.user')}</th>
              <th>{t('admin.audit.action')}</th>
              <th>{t('admin.audit.object_type')}</th>
              <th>{t('admin.audit.details')}</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center">{t('common.loading')}</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="text-center">{t('admin.audit.no_entries')}</td></tr>
            ) : entries.map(entry => (
              <tr key={entry.id}>
                <td className="nowrap">{formatDate(entry.createdAt)}</td>
                <td className="font-mono">{entry.username || `#${entry.userId}`}</td>
                <td>
                  <span
                    className="action-badge"
                    style={{ backgroundColor: ACTION_COLORS[entry.action] || '#6b7280' }}
                  >
                    {entry.action}
                  </span>
                </td>
                <td>
                  {entry.objectType && (
                    <span>{entry.objectType} #{entry.objectId}</span>
                  )}
                </td>
                <td className="details-cell">{formatDetails(entry.details)}</td>
                <td className="font-mono">{entry.ipAddress || '—'}</td>
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
    </div>
  );
};

export default AuditLog;
