import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { cn } from '@/lib/utils'
import type { WorkflowNode, StepStatus } from '@/types'
import { Type, Globe, Layers, Clock, Code, CheckCircle, XCircle, Loader2, SkipForward, RotateCcw } from 'lucide-react'

const pluginIcons: Record<string, React.ElementType> = {
  TEXT_TRANSFORM: Type,
  API_PROXY: Globe,
  DATA_AGGREGATOR: Layers,
  DELAY: Clock,
  CUSTOM: Code,
}

const statusIcons: Record<StepStatus, React.ElementType> = {
  PENDING: Clock,
  RUNNING: Loader2,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
  SKIPPED: SkipForward,
  RETRYING: RotateCcw,
}

const statusColors: Record<StepStatus, string> = {
  PENDING: 'bg-slate-100 border-slate-300',
  RUNNING: 'bg-blue-100 border-blue-400',
  COMPLETED: 'bg-green-100 border-green-400',
  FAILED: 'bg-red-100 border-red-400',
  SKIPPED: 'bg-yellow-100 border-yellow-400',
  RETRYING: 'bg-orange-100 border-orange-400',
}

const statusIconColors: Record<StepStatus, string> = {
  PENDING: 'text-slate-400',
  RUNNING: 'text-blue-600 animate-spin',
  COMPLETED: 'text-green-600',
  FAILED: 'text-red-600',
  SKIPPED: 'text-yellow-600',
  RETRYING: 'text-orange-600 animate-spin',
}

interface ExecutionNodeData extends WorkflowNode {
  status?: StepStatus
}

function ExecutionNode({ data }: NodeProps<ExecutionNodeData>) {
  const Icon = pluginIcons[data.type] || Code
  const status = data.status || 'PENDING'
  const StatusIcon = statusIcons[status]

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-white shadow-sm min-w-[180px] transition-all',
        statusColors[status],
        status === 'RUNNING' && 'animate-pulse-border'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white"
      />

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{data.label}</p>
          <p className="text-xs text-slate-500">{data.type.replace('_', ' ')}</p>
        </div>
        <div className="flex-shrink-0">
          <StatusIcon className={cn('w-5 h-5', statusIconColors[status])} />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  )
}

export default memo(ExecutionNode)
