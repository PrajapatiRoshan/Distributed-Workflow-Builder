import { useNavigate } from 'react-router-dom'
import type { WorkflowRun } from '@/types'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { RUN_STATUS_LABELS } from '@/lib/constants'
import { Play, ChevronRight } from 'lucide-react'

interface RecentRunsProps {
  runs: WorkflowRun[]
  isLoading?: boolean
}

export default function RecentRuns({ runs, isLoading }: RecentRunsProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Runs</h3>
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
        <h3 className="text-lg font-semibold text-slate-900">Recent Runs</h3>
        <button
          onClick={() => navigate('/runs')}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-8">
          <Play className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No runs yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => navigate(`/runs/${run.id}`)}
              className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Play className="h-5 w-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {run.workflowName || `Run ${run.id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(run.createdAt)}
                </p>
              </div>
              <Badge variant="status" status={run.status} size="sm">
                {RUN_STATUS_LABELS[run.status]}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
