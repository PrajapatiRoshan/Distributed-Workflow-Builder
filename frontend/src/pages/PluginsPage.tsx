import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { usePluginsStore } from '@/stores/plugins.store'
import { useToast } from '@/hooks/useToast'
import PluginCard from '@/components/plugins/PluginCard'
import PluginDetailModal from '@/components/plugins/PluginDetailModal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { PLUGIN_TYPES } from '@/lib/constants'
import type { Plugin, PluginType } from '@/types'
import { Package, Search } from 'lucide-react'

export default function PluginsPage() {
  const { success, error: showError } = useToast()
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)

  const {
    plugins,
    isLoading,
    filters,
    fetchPlugins,
    installPlugin,
    setFilters,
    getFilteredPlugins,
  } = usePluginsStore()

  useEffect(() => {
    fetchPlugins()
  }, [fetchPlugins])

  const filteredPlugins = getFilteredPlugins()

  const handleInstall = async (slug: string) => {
    try {
      await installPlugin(slug)
      success('Plugin installed successfully')
    } catch {
      showError('Failed to install plugin')
    }
  }

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...PLUGIN_TYPES.map((t) => ({ value: t.value, label: t.label })),
  ]

  return (
    <div>
      <PageHeader
        title="Plugin Marketplace"
        description="Browse and install plugins to extend your workflows"
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search plugins..."
            className="pl-10"
          />
        </div>
        <Select
          options={typeOptions}
          value={filters.type || ''}
          onChange={(value) => setFilters({ type: (value || null) as PluginType | null })}
          className="w-48"
        />
      </div>

      {/* Plugin Grid */}
      {isLoading && plugins.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filteredPlugins.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No plugins found"
          description={filters.search || filters.type ? 'Try adjusting your filters' : 'No plugins available yet'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onView={setSelectedPlugin}
              onInstall={handleInstall}
            />
          ))}
        </div>
      )}

      <PluginDetailModal
        plugin={selectedPlugin}
        isOpen={!!selectedPlugin}
        onClose={() => setSelectedPlugin(null)}
        onInstall={handleInstall}
      />
    </div>
  )
}
