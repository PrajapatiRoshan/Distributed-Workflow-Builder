import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Plus, Package } from 'lucide-react'

export default function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    {
      label: 'Create Workflow',
      icon: Plus,
      onClick: () => navigate('/workflows/new'),
      variant: 'primary' as const,
    },
    {
      label: 'Browse Plugins',
      icon: Package,
      onClick: () => navigate('/plugins'),
      variant: 'secondary' as const,
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            onClick={action.onClick}
            icon={<action.icon className="h-4 w-4" />}
            className="w-full justify-start"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
