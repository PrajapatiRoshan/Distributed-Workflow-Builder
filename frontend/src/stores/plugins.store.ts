import { create } from 'zustand'
import type { Plugin, PluginType } from '@/types'
import pluginsApi from '@/api/plugins.api'

interface PluginsState {
  plugins: Plugin[]
  selectedPlugin: Plugin | null
  isLoading: boolean
  error: string | null
  filters: {
    type: PluginType | null
    search: string
  }

  // Actions
  fetchPlugins: () => Promise<void>
  fetchPlugin: (slug: string) => Promise<void>
  installPlugin: (slug: string) => Promise<void>
  setFilters: (filters: Partial<PluginsState['filters']>) => void
  clearSelectedPlugin: () => void
  getFilteredPlugins: () => Plugin[]
}

export const usePluginsStore = create<PluginsState>((set, get) => ({
  plugins: [],
  selectedPlugin: null,
  isLoading: false,
  error: null,
  filters: {
    type: null,
    search: '',
  },

  fetchPlugins: async () => {
    set({ isLoading: true, error: null })
    try {
      const { type, search } = get().filters
      const { data } = await pluginsApi.list(type || undefined, search || undefined)
      if (data.data) {
        set({ plugins: data.data.items, isLoading: false })
      }
    } catch {
      set({ error: 'Failed to fetch plugins', isLoading: false })
    }
  },

  fetchPlugin: async (slug) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await pluginsApi.get(slug)
      if (data.data) {
        set({ selectedPlugin: data.data, isLoading: false })
      }
    } catch {
      set({ error: 'Failed to fetch plugin', isLoading: false })
    }
  },

  installPlugin: async (slug) => {
    try {
      await pluginsApi.install(slug)
    } catch {
      throw new Error('Failed to install plugin')
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }))
  },

  clearSelectedPlugin: () => set({ selectedPlugin: null }),

  getFilteredPlugins: () => {
    const { plugins, filters } = get()
    let filtered = plugins

    if (filters.type) {
      filtered = filtered.filter((p) => p.pluginType === filters.type)
    }

    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.description?.toLowerCase().includes(search)
      )
    }

    return filtered
  },
}))
