import type { Plugin } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Type, Globe, Layers, Clock, Code, Star, Download } from 'lucide-react'

const pluginIcons: Record<string, React.ElementType> = {
  TEXT_TRANSFORM: Type,
  API_PROXY: Globe,
  DATA_AGGREGATOR: Layers,
  DELAY: Clock,
  CUSTOM: Code,
}

interface PluginCardProps {
  plugin: Plugin
  onView: (plugin: Plugin) => void
  onInstall: (slug: string) => void
}

export default function PluginCard({ plugin, onView, onInstall }: PluginCardProps) {
  const Icon = pluginIcons[plugin.pluginType] || Code

  return (
    <Card hoverable className="flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{plugin.name}</h3>
          <p className="text-xs text-slate-500">{plugin.pluginType.replace('_', ' ')}</p>
        </div>
        {plugin.isPaid ? (
          <Badge variant="warning" size="sm">
            ${(plugin.priceCents / 100).toFixed(2)}
          </Badge>
        ) : (
          <Badge variant="success" size="sm">
            Free
          </Badge>
        )}
      </div>

      <p className="text-sm text-slate-600 mb-4 line-clamp-2 flex-1">
        {plugin.description || 'No description available'}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            {plugin.rating.toFixed(1)}
          </span>
          <span>v{plugin.version}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onView(plugin)}>
            Details
          </Button>
          <Button
            size="sm"
            onClick={() => onInstall(plugin.slug)}
            icon={<Download className="h-4 w-4" />}
          >
            Install
          </Button>
        </div>
      </div>
    </Card>
  )
}
