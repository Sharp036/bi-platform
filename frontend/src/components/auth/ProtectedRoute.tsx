import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import LoadingSpinner from '@/components/common/LoadingSpinner'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return <LoadingSpinner className="min-h-screen" />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <Outlet />
}
