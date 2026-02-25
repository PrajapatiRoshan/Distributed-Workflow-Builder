import { cn } from '@/lib/utils'
import { PLUGIN_TYPES } from '@/lib/constants'
import type { PluginType } from '@/types'
import { Type, Globe, Layers, Clock, Code, GripVertical } from 'lucide-react'

const pluginIcons: Record<string, React.ElementType> = {
  TEXT_TRANSFORM: Type,
  API_PROXY: Globe,
  DATA_AGGREGATOR: Layers,
  DELAY: Clock,
  CUSTOM: Code,
}

interface NodePaletteProps {
  className?: string
}

export default function NodePalette({ className }: NodePaletteProps) {
  const handleDragStart = (event: React.DragEvent, type: PluginType) => {
    event.dataTransfer.setData('application/reactflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className={cn('bg-white rounded-lg border border-slate-200 p-3', className)}>
      <h3 className="text-sm font-medium text-slate-900 mb-3">Nodes</h3>
      <div className="space-y-2">
        {PLUGIN_TYPES.map(({ value, label }) => {
          const Icon = pluginIcons[value] || Code

          return (
            <div
              key={value}
              draggable
              onDragStart={(e) => handleDragStart(e, value as PluginType)}
              className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-grab hover:bg-slate-100 hover:border-slate-300 transition-colors active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-slate-400" />
              <Icon className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-700">{label}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Drag nodes to the canvas
      </p>
    </div>
  )
}
