import { Outlet } from 'react-router-dom'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppShell() {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed)

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
