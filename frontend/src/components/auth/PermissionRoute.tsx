import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface PermissionRouteProps {
  permission: string
  children: JSX.Element
}

export default function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const user = useAuthStore(s => s.user)
  const allowed = user?.permissions?.includes(permission) ?? false
  return allowed ? children : <Navigate to="/" replace />
}

