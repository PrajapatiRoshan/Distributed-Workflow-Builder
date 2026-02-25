import apiClient from '@/lib/api-client'
import { API_URL } from '@/lib/constants'
import type { ApiResponse, WorkflowRun, RunStep, RunStatus } from '@/types'

export interface StartRunRequest {
  workflowId: string
  input?: Record<string, unknown>
}

export interface RunsListResponse {
  items: WorkflowRun[]
}

export const runsApi = {
  list: (limit = 20, workflowId?: string) =>
    apiClient.get<ApiResponse<RunsListResponse>>('/runs', {
      params: { limit, workflowId },
    }),

  get: (id: string) =>
    apiClient.get<ApiResponse<WorkflowRun & { steps: RunStep[] }>>(`/runs/${id}`),

  start: (data: StartRunRequest, idempotencyKey?: string) =>
    apiClient.post<ApiResponse<{ runId: string }>>(
      '/runs',
      data,
      {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      }
    ),

  updateStatus: (id: string, action: 'pause' | 'resume' | 'cancel') =>
    apiClient.patch<ApiResponse<{ runId: string; status: RunStatus }>>(`/runs/${id}/status`, { action }),

  getLogsStreamUrl: (id: string) => `${API_URL}/runs/${id}/logs/stream`,
}

export default runsApi
