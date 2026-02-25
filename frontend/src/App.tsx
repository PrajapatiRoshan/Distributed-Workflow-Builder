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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default function App() {
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
