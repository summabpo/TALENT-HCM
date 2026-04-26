import apiClient from './client'
import type {
  PaginatedResponse,
  NomiwebConfig,
  SyncLog,
  SyncStats,
  ConnectionStatus,
  SyncResult,
} from '@/types'

export const nomiwebConfigApi = {
  list: (params?: Record<string, string>) =>
    apiClient
      .get<PaginatedResponse<NomiwebConfig>>('/integrations/nomiweb/', { params })
      .then((r) => r.data),

  retrieve: (id: number | string) =>
    apiClient.get<NomiwebConfig>(`/integrations/nomiweb/${id}/`).then((r) => r.data),

  create: (data: Partial<NomiwebConfig>) =>
    apiClient.post<NomiwebConfig>('/integrations/nomiweb/', data).then((r) => r.data),

  update: (id: number | string, data: Partial<NomiwebConfig>) =>
    apiClient
      .patch<NomiwebConfig>(`/integrations/nomiweb/${id}/`, data)
      .then((r) => r.data),

  testConnection: (id: number | string) =>
    apiClient
      .post<ConnectionStatus>(`/integrations/nomiweb/${id}/test-connection/`)
      .then((r) => r.data),

  syncNow: (id: number | string) =>
    apiClient
      .post<SyncResult>(`/integrations/nomiweb/${id}/sync-now/`)
      .then((r) => r.data),

  syncCatalogs: (id: number | string) =>
    apiClient
      .post<{ ok: boolean; stats: SyncStats }>(`/integrations/nomiweb/${id}/sync-catalogs/`)
      .then((r) => r.data),
}

export const syncLogApi = {
  list: (params?: Record<string, string>) =>
    apiClient
      .get<PaginatedResponse<SyncLog>>('/integrations/sync-logs/', { params })
      .then((r) => r.data),

  retrieve: (id: string) =>
    apiClient.get<SyncLog>(`/integrations/sync-logs/${id}/`).then((r) => r.data),
}
