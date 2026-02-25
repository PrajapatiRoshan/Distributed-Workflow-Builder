import apiClient from '@/lib/api-client'
import type { ApiResponse, UserRole } from '@/types'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  tenantName?: string
}

export interface AuthResponse {
  accessToken: string
  expiresIn: number
  userId: string
  tenantId: string
  role: UserRole
}

export interface UserResponse {
  id: string
  tenant_id: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data),

  register: (data: RegisterRequest) =>
    apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data),

  refresh: (refreshToken: string) =>
    apiClient.post<ApiResponse<{ accessToken: string; expiresIn: number }>>('/auth/refresh', { refreshToken }),

  logout: () =>
    apiClient.post('/auth/logout'),

  getMe: () =>
    apiClient.get<ApiResponse<UserResponse>>('/auth/me'),
}

export default authApi
