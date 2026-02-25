import { useBuilderStore } from '@/stores/builder.store'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { X, Trash2 } from 'lucide-react'
import type { PluginType } from '@/types'

const textTransformOperations = [
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'caesar', label: 'Caesar Cipher' },
  { value: 'sha256', label: 'SHA-256 Hash' },
]

const httpMethods = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]

const aggregatorOperations = [
  { value: 'merge', label: 'Merge' },
  { value: 'concat', label: 'Concatenate' },
  { value: 'sum', label: 'Sum' },
]

export default function NodeConfigPanel() {
  const { nodes, selectedNodeId, selectNode, updateNodeConfig, updateNodeLabel, deleteSelected } = useBuilderStore()

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  if (!selectedNode) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-500 text-center py-8">
          Select a node to configure
        </p>
      </div>
    )
  }

  const { data } = selectedNode
  const config = data.config || {}

  const renderConfigFields = () => {
    switch (data.type as PluginType) {
      case 'TEXT_TRANSFORM':
        return (
          <>
            <Select
              label="Operation"
              options={textTransformOperations}
              value={String(config.operation || 'uppercase')}
              onChange={(value) => updateNodeConfig(selectedNodeId!, { operation: value })}
            />
            <Input
              label="Input Text (or use previous step output)"
              value={String(config.text || '')}
              onChange={(e) => updateNodeConfig(selectedNodeId!, { text: e.target.value })}
              placeholder="Text to transform..."
            />
            {config.operation === 'caesar' && (
              <Input
                label="Shift Amount"
                type="number"
                value={String(config.shift || 3)}
                onChange={(e) => updateNodeConfig(selectedNodeId!, { shift: parseInt(e.target.value) || 3 })}
              />
            )}
          </>
        )

      case 'API_PROXY':
        return (
          <>
            <Input
              label="URL"
              value={String(config.url || '')}
              onChange={(e) => updateNodeConfig(selectedNodeId!, { url: e.target.value })}
              placeholder="https://api.example.com/endpoint"
            />
            <Select
              label="Method"
              options={httpMethods}
              value={String(config.method || 'GET')}
              onChange={(value) => updateNodeConfig(selectedNodeId!, { method: value })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Headers (JSON)
              </label>
              <textarea
                value={JSON.stringify(config.headers || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value)
                    updateNodeConfig(selectedNodeId!, { headers })
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </>
        )

      case 'DATA_AGGREGATOR':
        return (
          <Select
            label="Operation"
            options={aggregatorOperations}
            value={String(config.operation || 'merge')}
            onChange={(value) => updateNodeConfig(selectedNodeId!, { operation: value })}
          />
        )

      case 'DELAY':
        return (
          <Input
            label="Delay (ms)"
            type="number"
            value={String(config.delayMs || 1000)}
            onChange={(e) => updateNodeConfig(selectedNodeId!, { delayMs: parseInt(e.target.value) || 1000 })}
            hint="Minimum 100ms, maximum 60000ms"
          />
        )

      case 'CUSTOM':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Code
            </label>
            <textarea
              value={String(config.code || '')}
              onChange={(e) => updateNodeConfig(selectedNodeId!, { code: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="// Your custom code here"
            />
          </div>
        )

      default:
        return <p className="text-sm text-slate-500">No configuration available</p>
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-900">Node Configuration</h3>
        <button
          onClick={() => selectNode(null)}
          className="p-1 rounded hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="space-y-4">
        <Input
          label="Label"
          value={data.label}
          onChange={(e) => updateNodeLabel(selectedNodeId!, e.target.value)}
        />

        <div className="border-t border-slate-200 pt-4">
          <h4 className="text-xs font-medium text-slate-500 uppercase mb-3">
            {data.type.replace('_', ' ')} Settings
          </h4>
          <div className="space-y-3">
            {renderConfigFields()}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <Button
            variant="danger"
            size="sm"
            onClick={deleteSelected}
            icon={<Trash2 className="h-4 w-4" />}
            className="w-full"
          >
            Delete Node
          </Button>
        </div>
      </div>
    </div>
  )
}
