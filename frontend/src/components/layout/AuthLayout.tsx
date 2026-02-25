import { Outlet } from 'react-router-dom'
import { Workflow } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
              <Workflow className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
            <p className="text-sm text-slate-500 mt-1">Build and orchestrate workflows visually</p>
          </div>

          {/* Auth Card */}
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6">
            <Outlet />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </footer>
    </div>
  )
}
