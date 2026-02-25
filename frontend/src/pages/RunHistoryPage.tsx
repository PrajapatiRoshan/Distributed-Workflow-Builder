import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/layout/PageHeader'
import { useRunsStore } from '@/stores/runs.store'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { RUN_STATUS_LABELS } from '@/lib/constants'
import { formatDate, formatDuration } from '@/lib/utils'
import { Play, ExternalLink } from 'lucide-react'

export default function RunHistoryPage() {
  const navigate = useNavigate()
  const { runs, isLoading, fetchRuns } = useRunsStore()

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  return (
    <div>
      <PageHeader
        title="Run History"
        description="View all workflow execution history"
      />

      {isLoading && runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Workflow</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRowSkeleton key={i} columns={6} />
              ))}
            </tbody>
          </table>
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Play}
          title="No runs yet"
          description="Execute a workflow to see runs here"
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Workflow</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {runs.map((run) => {
                const startDate = new Date(run.createdAt)
                const endDate = run.completedAt ? new Date(run.completedAt) : new Date()
                const duration = endDate.getTime() - startDate.getTime()

                return (
                  <tr
                    key={run.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/runs/${run.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-slate-900">
                        {run.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {run.workflowName || 'Unknown Workflow'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="status" status={run.status} size="sm">
                        {RUN_STATUS_LABELS[run.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {formatDate(run.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {run.status === 'RUNNING' || run.status === 'PENDING'
                          ? '-'
                          : formatDuration(duration)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/runs/${run.id}`)
                        }}
                        className="p-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
