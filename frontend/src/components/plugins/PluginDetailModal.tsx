import type { Plugin } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Star, Download, User, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface PluginDetailModalProps {
  plugin: Plugin | null
  isOpen: boolean
  onClose: () => void
  onInstall: (slug: string) => void
}

export default function PluginDetailModal({
  plugin,
  isOpen,
  onClose,
  onInstall,
}: PluginDetailModalProps) {
  if (!plugin) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={plugin.name} size="lg">
      <div className="space-y-6">
        {/* Header info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="info">{plugin.pluginType.replace('_', ' ')}</Badge>
            <span className="text-sm text-slate-500">v{plugin.version}</span>
          </div>
          {plugin.isPaid ? (
            <Badge variant="warning" size="md">
              ${(plugin.priceCents / 100).toFixed(2)}
            </Badge>
          ) : (
            <Badge variant="success" size="md">
              Free
            </Badge>
          )}
        </div>

        {/* Description */}
        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-2">Description</h4>
          <p className="text-sm text-slate-600">
            {plugin.description || 'No description available'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Star className="h-4 w-4 fill-amber-400" />
              <span className="font-semibold">{plugin.rating.toFixed(1)}</span>
            </div>
            <p className="text-xs text-slate-500">{plugin.reviewsCount} reviews</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-700 mb-1">
              <Calendar className="h-4 w-4" />
            </div>
            <p className="text-xs text-slate-500">{formatDate(plugin.createdAt, { dateStyle: 'short' })}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-700 mb-1">
              <User className="h-4 w-4" />
            </div>
            <p className="text-xs text-slate-500">Author</p>
          </div>
        </div>

        {/* Schema Preview */}
        {plugin.schema && (
          <div>
            <h4 className="text-sm font-medium text-slate-900 mb-2">Input/Output Schema</h4>
            <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-48">
              <pre className="text-xs text-slate-300">
                {JSON.stringify(plugin.schema, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onInstall(plugin.slug)
              onClose()
            }}
            icon={<Download className="h-4 w-4" />}
          >
            {plugin.isPaid ? `Buy for $${(plugin.priceCents / 100).toFixed(2)}` : 'Install'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
