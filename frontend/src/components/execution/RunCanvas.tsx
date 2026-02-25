import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import ExecutionNode from './ExecutionNode'
import type { WorkflowDefinition, StepStatus } from '@/types'
import type { Node, Edge } from 'reactflow'

const nodeTypes = {
  execution: ExecutionNode,
}

interface RunCanvasProps {
  definition: WorkflowDefinition
  stepStatuses: Map<string, StepStatus>
}

export default function RunCanvas({ definition, stepStatuses }: RunCanvasProps) {
  const nodes: Node[] = definition.nodes.map((node) => ({
    id: node.id,
    type: 'execution',
    position: node.position,
    data: {
      ...node,
      status: stepStatuses.get(node.id) || 'PENDING',
    },
    draggable: false,
    selectable: false,
  }))

  const edges: Edge[] = definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.condition !== undefined,
    style: edge.condition
      ? { stroke: edge.condition === 'true' ? '#22c55e' : '#ef4444' }
      : { stroke: '#94a3b8' },
  }))

  return (
    <ReactFlowProvider>
      <div className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          className="bg-slate-50"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
        >
          <Background gap={15} size={1} color="#e2e8f0" />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            position="bottom-right"
            nodeColor={(node) => {
              const status = node.data?.status as StepStatus
              const colors: Record<StepStatus, string> = {
                PENDING: '#94a3b8',
                RUNNING: '#60a5fa',
                COMPLETED: '#4ade80',
                FAILED: '#f87171',
                SKIPPED: '#fbbf24',
                RETRYING: '#fb923c',
              }
              return colors[status] || '#94a3b8'
            }}
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}
