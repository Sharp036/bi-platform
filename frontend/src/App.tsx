import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
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
          <Route path="/" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportListPage />} />
          <Route path="/reports/new" element={<ReportDesignerPage />} />
          <Route path="/reports/:id/edit" element={<ReportDesignerPage />} />
          <Route path="/reports/:id" element={<ReportViewerPage />} />
          <Route path="/queries" element={<QueryListPage />} />
          <Route path="/datasources" element={<DataSourceListPage />} />
          <Route path="/schedules" element={<ScheduleListPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/scripts" element={<ScriptEditorPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-4">404</h1>
            <p>Page not found</p>
          </div>
        </div>
      } />
    </Routes>
  )
}
