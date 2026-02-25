import { useNavigate } from 'react-router-dom'
import type { Workflow } from '@/types'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Workflow as WorkflowIcon, ChevronRight } from 'lucide-react'

interface RecentWorkflowsProps {
  workflows: Workflow[]
  isLoading?: boolean
}

export default function RecentWorkflows({ workflows, isLoading }: RecentWorkflowsProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Workflows</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-3 rounded-lg bg-slate-50">
              <div className="w-10 h-10 rounded-lg bg-slate-200" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-24 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Recent Workflows</h3>
        <button
          onClick={() => navigate('/workflows')}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-8">
          <WorkflowIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No workflows yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
              className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <WorkflowIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {workflow.name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(workflow.updatedAt)}
                </p>
              </div>
              <Badge variant={workflow.isPublished ? 'success' : 'default'} size="sm">
                {workflow.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
