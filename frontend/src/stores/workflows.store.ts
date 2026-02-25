import { create } from 'zustand'
import type { Workflow, WorkflowVersion, WorkflowDefinition } from '@/types'
import workflowsApi from '@/api/workflows.api'

interface WorkflowsState {
  workflows: Workflow[]
  currentWorkflow: (Workflow & { definition?: WorkflowDefinition }) | null
  currentVersion: WorkflowVersion | null
  versions: WorkflowVersion[]
  isLoading: boolean
  error: string | null
  cursor: string | null
  hasMore: boolean

  // Actions
  fetchWorkflows: (reset?: boolean) => Promise<void>
  fetchWorkflow: (id: string) => Promise<void>
  fetchVersions: (id: string) => Promise<void>
  createWorkflow: (data: { name: string; description?: string; definition: WorkflowDefinition }) => Promise<string>
  updateWorkflow: (id: string, data: { name?: string; description?: string; definition?: WorkflowDefinition }) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  publishWorkflow: (id: string) => Promise<void>
  clearCurrent: () => void
}

export const useWorkflowsStore = create<WorkflowsState>((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  currentVersion: null,
  versions: [],
  isLoading: false,
  error: null,
  cursor: null,
  hasMore: true,

  fetchWorkflows: async (reset = false) => {
    const { cursor, workflows } = get()
    if (!reset && !get().hasMore) return

    set({ isLoading: true, error: null })
    try {
      const { data } = await workflowsApi.list(reset ? undefined : cursor || undefined, 20)
      if (data.data) {
        set({
          workflows: reset ? data.data.items : [...workflows, ...data.data.items],
          cursor: data.data.cursor || null,
          hasMore: data.data.hasNext,
          isLoading: false,
        })
      }
    } catch (err) {
      set({ error: 'Failed to fetch workflows', isLoading: false })
    }
  },

  fetchWorkflow: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await workflowsApi.get(id)
      if (data.data) {
        set({ currentWorkflow: data.data, isLoading: false })
      }
    } catch (err) {
      set({ error: 'Failed to fetch workflow', isLoading: false })
    }
  },

  fetchVersions: async (id) => {
    try {
      const { data } = await workflowsApi.getVersions(id)
      if (data.data) {
        set({ versions: data.data.items })
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err)
    }
  },

  createWorkflow: async (workflowData) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await workflowsApi.create(workflowData)
      if (data.data) {
        // Refresh the list
        get().fetchWorkflows(true)
        return data.data.id
      }
      throw new Error('Failed to create workflow')
    } catch (err) {
      set({ error: 'Failed to create workflow', isLoading: false })
      throw err
    }
  },

  updateWorkflow: async (id, workflowData) => {
    set({ isLoading: true, error: null })
    try {
      await workflowsApi.update(id, workflowData)
      // Refresh the current workflow
      await get().fetchWorkflow(id)
      set({ isLoading: false })
    } catch (err) {
      set({ error: 'Failed to update workflow', isLoading: false })
      throw err
    }
  },

  deleteWorkflow: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await workflowsApi.delete(id)
      set((state) => ({
        workflows: state.workflows.filter((w) => w.id !== id),
        isLoading: false,
      }))
    } catch (err) {
      set({ error: 'Failed to delete workflow', isLoading: false })
      throw err
    }
  },

  publishWorkflow: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await workflowsApi.publish(id)
      // Refresh the workflow
      await get().fetchWorkflow(id)
      // Update in list
      set((state) => ({
        workflows: state.workflows.map((w) =>
          w.id === id ? { ...w, isPublished: true } : w
        ),
        isLoading: false,
      }))
    } catch (err) {
      set({ error: 'Failed to publish workflow', isLoading: false })
      throw err
    }
  },

  clearCurrent: () => set({ currentWorkflow: null, currentVersion: null, versions: [] }),
}))
