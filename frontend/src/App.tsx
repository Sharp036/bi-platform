import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import PermissionRoute from '@/components/auth/PermissionRoute'
import LoginPage from '@/components/auth/LoginPage'
import AppLayout from '@/components/layout/AppLayout'

import DashboardPage from '@/components/dashboard/DashboardPage'
import ScheduleListPage from '@/components/dashboard/ScheduleListPage'
import ReportListPage from '@/components/reports/ReportListPage'
import ReportViewerPage from '@/components/reports/ReportViewerPage'
import QueryListPage from '@/components/queries/QueryListPage'
import DataSourceListPage from '@/components/datasources/DataSourceListPage'
import ScriptEditorPage from '@/components/scripts/ScriptEditorPage'
import ReportDesignerPage from '@/components/designer/ReportDesignerPage'
import EmbedViewerPage from '@/components/embed/EmbedViewerPage'
import AlertsPage from '@/components/alerts/AlertsPage'
import MonitoringPage from '@/components/monitoring/MonitoringPage'
import AdminPage from '@/components/admin/AdminPage'
import ChangePassword from '@/components/admin/ChangePassword'
import SharedWithMePage from '@/components/sharing/SharedWithMePage'
import WorkspacePage from '@/components/workspace/WorkspacePage'
import ModelListPage from '@/components/modeling/ModelListPage'
import ModelEditorPage from '@/components/modeling/ModelEditorPage'
import ExplorePage from '@/components/modeling/ExplorePage'
import TemplateGalleryPage from '@/components/templates/TemplateGalleryPage'

function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p>{t('common.not_found.message')}</p>
      </div>
    </div>
  )
}

export default function App() {
  const checkAuth = useAuthStore(s => s.checkAuth)

  useEffect(() => { checkAuth() }, [checkAuth])

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/embed/:token" element={<EmbedViewerPage />} />

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<WorkspacePage />} />
          <Route
            path="/reports"
            element={
              <PermissionRoute permission="REPORT_VIEW">
                <ReportListPage />
              </PermissionRoute>
            }
          />
          <Route path="/reports/new" element={<ReportDesignerPage />} />
          <Route path="/reports/:id/edit" element={<ReportDesignerPage />} />
          <Route path="/reports/:id" element={<ReportViewerPage />} />
          <Route path="/queries" element={<QueryListPage />} />
          <Route
            path="/datasources"
            element={
              <PermissionRoute permission="DATASOURCE_VIEW">
                <DataSourceListPage />
              </PermissionRoute>
            }
          />
          <Route path="/schedules" element={<ScheduleListPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/scripts" element={<ScriptEditorPage />} />
          <Route
            path="/admin"
            element={
              <PermissionRoute permission="USER_MANAGE">
                <AdminPage />
              </PermissionRoute>
            }
          />
          <Route path="/profile/password" element={<ChangePassword />} />
          <Route path="/shared" element={<SharedWithMePage />} />
          <Route path="/models" element={<ModelListPage />} />
          <Route path="/models/:id" element={<ModelEditorPage />} />
          <Route path="/explore/:modelId" element={<ExplorePage />} />
          <Route path="/templates" element={<TemplateGalleryPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
