import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBuilderStore } from '@/stores/builder.store'
import { useWorkflowsStore } from '@/stores/workflows.store'
import { PageLoader } from '@/components/ui/Spinner'
import BuilderToolbar from '@/components/builder/BuilderToolbar'
import Canvas from '@/components/builder/Canvas'
import NodePalette from '@/components/builder/NodePalette'
import NodeConfigPanel from '@/components/builder/NodeConfigPanel'

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>()
  const { loadWorkflow, resetBuilder } = useBuilderStore()
  const { currentWorkflow, fetchWorkflow, isLoading, clearCurrent } = useWorkflowsStore()

  useEffect(() => {
    if (id) {
      fetchWorkflow(id)
    } else {
      resetBuilder()
    }

    return () => {
      clearCurrent()
    }
  }, [id, fetchWorkflow, resetBuilder, clearCurrent])

  useEffect(() => {
    if (currentWorkflow && id) {
      loadWorkflow(
        currentWorkflow.id,
        currentWorkflow.name,
        currentWorkflow.description || '',
        currentWorkflow.definition || { nodes: [], edges: [] }
      )
    }
  }, [currentWorkflow, id, loadWorkflow])

  if (id && isLoading) {
    return <PageLoader />
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-100">
      <BuilderToolbar />

      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Node Palette */}
        <div className="w-56 p-3 overflow-y-auto border-r border-slate-200 bg-slate-50">
          <NodePalette />
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <Canvas />
        </div>

        {/* Right Sidebar - Node Config */}
        <div className="w-72 p-3 overflow-y-auto border-l border-slate-200 bg-slate-50">
          <NodeConfigPanel />
        </div>
      </div>
    </div>
  )
}
