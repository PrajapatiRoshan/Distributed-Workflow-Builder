import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRunsStore } from '@/stores/runs.store'
import { useWorkflowsStore } from '@/stores/workflows.store'
import { useRunSubscription } from '@/hooks/useRunSubscription'
import PageHeader from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import RunCanvas from '@/components/execution/RunCanvas'
import RunControls from '@/components/execution/RunControls'
import RunProgress from '@/components/execution/RunProgress'
import LogViewer from '@/components/logs/LogViewer'
import { RUN_STATUS_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import type { StepStatus, WorkflowDefinition } from '@/types'

export default function ExecutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    currentRun,
    currentRunSteps,
    liveStepStatuses,
    liveLogs,
    isLoading,
    fetchRun,
  } = useRunsStore()

  const { currentWorkflow, fetchWorkflow } = useWorkflowsStore()

  // Subscribe to real-time updates
  useRunSubscription(id || null)

  useEffect(() => {
    if (id) {
      fetchRun(id)
    }
  }, [id, fetchRun])

  useEffect(() => {
    if (currentRun?.workflowId) {
      fetchWorkflow(currentRun.workflowId)
    }
  }, [currentRun?.workflowId, fetchWorkflow])

  // Build step statuses map
  const stepStatuses = useMemo(() => {
    const map = new Map<string, StepStatus>()

    // First, add statuses from fetched steps
    currentRunSteps.forEach((step) => {
      map.set(step.stepId, step.status)
    })

    // Then overlay with live statuses
    liveStepStatuses.forEach((status, stepId) => {
      map.set(stepId, status)
    })

    return map
  }, [currentRunSteps, liveStepStatuses])

  // Get definition from current workflow or build from steps
  const definition: WorkflowDefinition = useMemo(() => {
    if (currentWorkflow?.definition) {
      return currentWorkflow.definition
    }

    // Build a simple definition from steps if we don't have the workflow
    return {
      nodes: currentRunSteps.map((step, index) => ({
        id: step.stepId,
        type: 'CUSTOM' as const,
        pluginId: step.pluginId || 'unknown',
        pluginVersion: '1.0.0',
        label: `Step ${index + 1}`,
        config: {},
        position: { x: 250, y: index * 120 },
      })),
      edges: [],
    }
  }, [currentWorkflow, currentRunSteps])

  if (isLoading || !currentRun) {
    return <PageLoader />
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader
        title={`Run: ${currentRun.id.slice(0, 8)}...`}
        description={`Started ${formatDate(currentRun.createdAt)}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="status" status={currentRun.status} size="md">
              {RUN_STATUS_LABELS[currentRun.status]}
            </Badge>
            <RunControls runId={currentRun.id} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchRun(currentRun.id)}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/runs')}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Runs
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: '500px' }}>
            <RunCanvas definition={definition} stepStatuses={stepStatuses} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <RunProgress steps={currentRunSteps} />

          {/* Run Details */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-medium text-slate-900 mb-3">Run Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Run ID</dt>
                <dd className="text-slate-900 font-mono">{currentRun.id.slice(0, 12)}...</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="text-slate-900">{currentRun.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Started</dt>
                <dd className="text-slate-900">{formatDate(currentRun.createdAt)}</dd>
              </div>
              {currentRun.completedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Completed</dt>
                  <dd className="text-slate-900">{formatDate(currentRun.completedAt)}</dd>
                </div>
              )}
              {currentRun.error && (
                <div className="flex flex-col gap-1">
                  <dt className="text-slate-500">Error</dt>
                  <dd className="text-red-600 text-xs break-all">{currentRun.error}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Logs</h3>
        <LogViewer logs={liveLogs} className="h-64" />
      </div>
    </div>
  )
}
