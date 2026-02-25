import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Toaster } from '@/components/ui/Toaster'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// Layouts
import AuthLayout from '@/components/layout/AuthLayout'
import AppShell from '@/components/layout/AppShell'

// Pages
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import WorkflowsPage from '@/pages/WorkflowsPage'
import BuilderPage from '@/pages/BuilderPage'
import ExecutionPage from '@/pages/ExecutionPage'
import RunHistoryPage from '@/pages/RunHistoryPage'
import PluginsPage from '@/pages/PluginsPage'
import NotFoundPage from '@/pages/NotFoundPage'

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const accessToken = useAuthStore((state) => state.accessToken)

  // Check if we have both state and token
  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const accessToken = useAuthStore((state) => state.accessToken)

  // Only redirect if we have both state and token
  if (isAuthenticated && accessToken) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const accessToken = useAuthStore((state) => state.accessToken)
  const logout = useAuthStore((state) => state.logout)

  // Validate auth state on mount
  useEffect(() => {
    const validateAuth = async () => {
      // If persisted state says authenticated but no token, clear the state
      if (isAuthenticated && !accessToken) {
        await logout()
      }
      setIsInitialized(true)
    }

    validateAuth()
  }, [])

  // Show nothing while initializing to prevent route flashing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          {/* Protected routes - Full screen (no sidebar) */}
          <Route element={<ProtectedRoute />}>
            <Route path="workflows/new" element={<BuilderPage />} />
            <Route path="workflows/:id/edit" element={<BuilderPage />} />
            <Route path="runs/:id" element={<ExecutionPage />} />
          </Route>

          {/* Protected routes - With sidebar */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="workflows" element={<WorkflowsPage />} />
              <Route path="runs" element={<RunHistoryPage />} />
              <Route path="plugins" element={<PluginsPage />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
