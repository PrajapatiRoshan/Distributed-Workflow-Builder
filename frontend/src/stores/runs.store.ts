import { create } from 'zustand'
import type { WorkflowRun, RunStep, StepLog, RunStatus, StepStatus } from '@/types'
import runsApi from '@/api/runs.api'

interface RunsState {
  runs: WorkflowRun[]
  currentRun: WorkflowRun | null
  currentRunSteps: RunStep[]
  isLoading: boolean
  error: string | null

  // Real-time state
  liveStepStatuses: Map<string, StepStatus>
  liveLogs: StepLog[]

  // Actions
  fetchRuns: (workflowId?: string) => Promise<void>
  fetchRun: (runId: string) => Promise<void>
  startRun: (workflowId: string, input?: Record<string, unknown>) => Promise<string>
  pauseRun: (runId: string) => Promise<void>
  resumeRun: (runId: string) => Promise<void>
  cancelRun: (runId: string) => Promise<void>

  // Real-time updates
  updateStepStatus: (stepId: string, status: StepStatus, output?: Record<string, unknown>) => void
  updateRunStatus: (status: RunStatus) => void
  appendLog: (log: StepLog) => void
  clearLiveState: () => void
}

export const useRunsStore = create<RunsState>((set) => ({
  runs: [],
  currentRun: null,
  currentRunSteps: [],
  isLoading: false,
  error: null,
  liveStepStatuses: new Map(),
  liveLogs: [],

  fetchRuns: async (workflowId) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await runsApi.list(50, workflowId)
      if (data.data) {
        set({ runs: data.data.items, isLoading: false })
      }
    } catch {
      set({ error: 'Failed to fetch runs', isLoading: false })
    }
  },

  fetchRun: async (runId) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await runsApi.get(runId)
      if (data.data) {
        const run = data.data
        set({
          currentRun: run,
          currentRunSteps: run.steps || [],
          isLoading: false,
        })
      }
    } catch {
      set({ error: 'Failed to fetch run', isLoading: false })
    }
  },

  startRun: async (workflowId, input) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await runsApi.start({ workflowId, input })
      if (data.data?.runId) {
        set({ isLoading: false })
        return data.data.runId
      }
      throw new Error('No run ID returned')
    } catch {
      set({ error: 'Failed to start run', isLoading: false })
      throw new Error('Failed to start run')
    }
  },

  pauseRun: async (runId) => {
    try {
      await runsApi.updateStatus(runId, 'pause')
      set((state) => ({
        currentRun: state.currentRun
          ? { ...state.currentRun, status: 'PAUSED' }
          : null,
      }))
    } catch {
      throw new Error('Failed to pause run')
    }
  },

  resumeRun: async (runId) => {
    try {
      await runsApi.updateStatus(runId, 'resume')
      set((state) => ({
        currentRun: state.currentRun
          ? { ...state.currentRun, status: 'RUNNING' }
          : null,
      }))
    } catch {
      throw new Error('Failed to resume run')
    }
  },

  cancelRun: async (runId) => {
    try {
      await runsApi.updateStatus(runId, 'cancel')
      set((state) => ({
        currentRun: state.currentRun
          ? { ...state.currentRun, status: 'CANCELLED' }
          : null,
      }))
    } catch {
      throw new Error('Failed to cancel run')
    }
  },

  updateStepStatus: (stepId, status, output) => {
    set((state) => {
      const newStatuses = new Map(state.liveStepStatuses)
      newStatuses.set(stepId, status)

      // Also update in currentRunSteps if present
      const updatedSteps = state.currentRunSteps.map((step) =>
        step.stepId === stepId
          ? { ...step, status, output: output || step.output }
          : step
      )

      return {
        liveStepStatuses: newStatuses,
        currentRunSteps: updatedSteps,
      }
    })
  },

  updateRunStatus: (status) => {
    set((state) => ({
      currentRun: state.currentRun
        ? { ...state.currentRun, status }
        : null,
    }))
  },

  appendLog: (log) => {
    set((state) => ({
      liveLogs: [...state.liveLogs, log].slice(-500), // Keep last 500 logs
    }))
  },

  clearLiveState: () => {
    set({
      liveStepStatuses: new Map(),
      liveLogs: [],
    })
  },
}))
