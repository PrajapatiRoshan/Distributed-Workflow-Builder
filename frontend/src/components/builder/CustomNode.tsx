import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { cn } from '@/lib/utils'
import type { WorkflowNode, PluginType } from '@/types'
import { Type, Globe, Layers, Clock, Code } from 'lucide-react'

const pluginIcons: Record<PluginType, React.ElementType> = {
  TEXT_TRANSFORM: Type,
  API_PROXY: Globe,
  DATA_AGGREGATOR: Layers,
  DELAY: Clock,
  CUSTOM: Code,
}

const pluginColors: Record<PluginType, string> = {
  TEXT_TRANSFORM: 'bg-purple-100 border-purple-300 text-purple-700',
  API_PROXY: 'bg-blue-100 border-blue-300 text-blue-700',
  DATA_AGGREGATOR: 'bg-green-100 border-green-300 text-green-700',
  DELAY: 'bg-amber-100 border-amber-300 text-amber-700',
  CUSTOM: 'bg-slate-100 border-slate-300 text-slate-700',
}

function CustomNode({ data, selected }: NodeProps<WorkflowNode>) {
  const Icon = pluginIcons[data.type] || Code

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-white shadow-sm min-w-[160px] transition-all',
        selected ? 'ring-2 ring-blue-500 ring-offset-2' : '',
        'hover:shadow-md'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white"
      />

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center border',
            pluginColors[data.type]
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{data.label}</p>
          <p className="text-xs text-slate-500">{data.type.replace('_', ' ')}</p>
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

export default memo(CustomNode)
