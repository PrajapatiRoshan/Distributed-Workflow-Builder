import apiClient from '@/lib/api-client'
import type { ApiResponse, Plugin } from '@/types'

export interface PluginsListResponse {
  items: Plugin[]
}

export const pluginsApi = {
  list: (type?: string, search?: string) =>
    apiClient.get<ApiResponse<PluginsListResponse>>('/plugins', {
      params: { type, search },
    }),

  get: (slug: string) =>
    apiClient.get<ApiResponse<Plugin>>(`/plugins/${slug}`),

  install: (slug: string) =>
    apiClient.post(`/plugins/${slug}/install`),
}

export default pluginsApi
