import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import StatsCard from '@/components/dashboard/StatsCard'
import RecentWorkflows from '@/components/dashboard/RecentWorkflows'
import RecentRuns from '@/components/dashboard/RecentRuns'
import QuickActions from '@/components/dashboard/QuickActions'
import { workflowsApi } from '@/api/workflows.api'
import { runsApi } from '@/api/runs.api'
import type { Workflow, WorkflowRun } from '@/types'
import { Workflow as WorkflowIcon, Play, CheckCircle, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalWorkflows: 0,
    totalRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
  })

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const [workflowsRes, runsRes] = await Promise.all([
          workflowsApi.list(undefined, 5),
          runsApi.list(5),
        ])

        const workflowsList = workflowsRes.data.data?.items || []
        const runsList = runsRes.data.data?.items || []

        setWorkflows(workflowsList)
        setRuns(runsList)

        // Calculate stats
        const completedRuns = runsList.filter((r) => r.status === 'COMPLETED').length
        const failedRuns = runsList.filter((r) => r.status === 'FAILED').length

        setStats({
          totalWorkflows: workflowsRes.data.data?.total || workflowsList.length,
          totalRuns: runsList.length,
          completedRuns,
          failedRuns,
        })
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your workflows and executions"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Workflows"
          value={stats.totalWorkflows}
          icon={WorkflowIcon}
        />
        <StatsCard
          title="Total Runs"
          value={stats.totalRuns}
          icon={Play}
        />
        <StatsCard
          title="Completed"
          value={stats.completedRuns}
          icon={CheckCircle}
        />
        <StatsCard
          title="Failed"
          value={stats.failedRuns}
          icon={AlertCircle}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentWorkflows workflows={workflows} isLoading={isLoading} />
          <RecentRuns runs={runs} isLoading={isLoading} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  )
}
