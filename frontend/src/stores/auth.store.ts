import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@/types'
import authApi from '@/api/auth.api'
import { resetSocket } from '@/lib/socket'

interface AuthUser {
  id: string
  tenantId: string
  email: string
  role: UserRole
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, tenantName?: string) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<void>
  fetchCurrentUser: () => Promise<void>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await authApi.login({ email, password })
          if (data.data) {
            const { accessToken, userId, tenantId, role } = data.data
            localStorage.setItem('accessToken', accessToken)
            set({
              user: { id: userId, tenantId, email, role },
              accessToken,
              isAuthenticated: true,
              isLoading: false,
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed'
          set({ error: message, isLoading: false })
          throw err
        }
      },

      register: async (email, password, tenantName) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await authApi.register({ email, password, tenantName })
          if (data.data) {
            const { accessToken, userId, tenantId, role } = data.data
            localStorage.setItem('accessToken', accessToken)
            set({
              user: { id: userId, tenantId, email, role },
              accessToken,
              isAuthenticated: true,
              isLoading: false,
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Registration failed'
          set({ error: message, isLoading: false })
          throw err
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          // Ignore errors on logout
        } finally {
          localStorage.removeItem('accessToken')
          resetSocket()
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            error: null,
          })
        }
      },

      refreshAccessToken: async () => {
        // Refresh token is httpOnly cookie, so just call the endpoint
        try {
          const { data } = await authApi.refresh('')
          if (data.data?.accessToken) {
            localStorage.setItem('accessToken', data.data.accessToken)
            set({ accessToken: data.data.accessToken })
          }
        } catch {
          // If refresh fails, logout
          get().logout()
          throw new Error('Session expired')
        }
      },

      fetchCurrentUser: async () => {
        const { accessToken } = get()
        if (!accessToken) return

        set({ isLoading: true })
        try {
          const { data } = await authApi.getMe()
          if (data.data) {
            const userData = data.data
            set({
              user: {
                id: userData.id,
                tenantId: userData.tenant_id,
                email: userData.email,
                role: userData.role,
              },
              isLoading: false,
            })
          }
        } catch {
          set({ isLoading: false })
        }
      },

      clearError: () => set({ error: null }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
)
