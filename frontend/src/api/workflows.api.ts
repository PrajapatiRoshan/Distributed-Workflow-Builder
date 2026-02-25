import apiClient from '@/lib/api-client'
import type { ApiResponse, Workflow, WorkflowVersion, WorkflowDefinition, ValidationResult, PaginatedResponse } from '@/types'

export interface CreateWorkflowRequest {
  name: string
  description?: string
  definition: WorkflowDefinition
}

export interface UpdateWorkflowRequest {
  name?: string
  description?: string
  definition?: WorkflowDefinition
}

export const workflowsApi = {
  list: (cursor?: string, limit = 20) =>
    apiClient.get<ApiResponse<PaginatedResponse<Workflow>>>('/workflows', {
      params: { cursor, limit },
    }),

  get: (id: string) =>
    apiClient.get<ApiResponse<Workflow & { definition: WorkflowDefinition }>>(`/workflows/${id}`),

  create: (data: CreateWorkflowRequest) =>
    apiClient.post<ApiResponse<{ id: string; versionId: string }>>('/workflows', data),

  update: (id: string, data: UpdateWorkflowRequest) =>
    apiClient.put<ApiResponse<{ workflowId: string; versionId?: string }>>(`/workflows/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/workflows/${id}`),

  publish: (id: string) =>
    apiClient.post(`/workflows/${id}/publish`),

  validate: (definition: WorkflowDefinition) =>
    apiClient.post<ApiResponse<ValidationResult>>('/workflows/validate', definition),

  getVersions: (id: string) =>
    apiClient.get<ApiResponse<{ items: WorkflowVersion[] }>>(`/workflows/${id}/versions`),

  getVersion: (id: string, versionId: string) =>
    apiClient.get<ApiResponse<WorkflowVersion>>(`/workflows/${id}/versions/${versionId}`),
}

export default workflowsApi
