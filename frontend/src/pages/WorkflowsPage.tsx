import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/layout/PageHeader'
import WorkflowCard from '@/components/workflow/WorkflowCard'
import CreateWorkflowModal from '@/components/workflow/CreateWorkflowModal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { useWorkflowsStore } from '@/stores/workflows.store'
import { useToast } from '@/hooks/useToast'
import { runsApi } from '@/api/runs.api'
import { Plus, Workflow as WorkflowIcon } from 'lucide-react'

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const {
    workflows,
    isLoading,
    hasMore,
    fetchWorkflows,
    createWorkflow,
    deleteWorkflow,
  } = useWorkflowsStore()

  useEffect(() => {
    fetchWorkflows(true)
  }, [fetchWorkflows])

  const handleCreate = async (name: string, description?: string) => {
    try {
      const id = await createWorkflow({
        name,
        description,
        definition: { nodes: [], edges: [] },
      })
      success('Workflow created successfully')
      navigate(`/workflows/${id}/edit`)
    } catch {
      showError('Failed to create workflow')
      throw new Error('Failed to create workflow')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkflow(id)
      success('Workflow deleted')
      setDeleteConfirm(null)
    } catch {
      showError('Failed to delete workflow')
    }
  }

  const handleRun = async (workflowId: string) => {
    try {
      const { data } = await runsApi.start({ workflowId })
      if (data.data?.runId) {
        success('Workflow started')
        navigate(`/runs/${data.data.runId}`)
      }
    } catch {
      showError('Failed to start workflow')
    }
  }

  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Create and manage your workflows"
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Workflow
          </Button>
        }
      />

      {isLoading && workflows.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No workflows yet"
          description="Create your first workflow to get started"
          action={{
            label: 'Create Workflow',
            onClick: () => setCreateModalOpen(true),
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onDelete={(id) => setDeleteConfirm(id)}
                onRun={handleRun}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="secondary"
                onClick={() => fetchWorkflows()}
                loading={isLoading}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <CreateWorkflowModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Workflow</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete this workflow? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
