import api from './client'
import type { LoginRequest, AuthResponse } from '@/types'

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data).then(r => r.data),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }).then(r => r.data),

  me: () =>
    api.get('/auth/me').then(r => r.data),

  updateLanguage: (language: string) =>
    api.put('/profile/language', { language }).then(r => r.data),
}
