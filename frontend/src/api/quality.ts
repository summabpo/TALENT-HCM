import apiClient from './client'
import type {
  PaginatedResponse, QualityProcess, QualityDocument,
  InternalAudit, NonConformity, QualityDashboard,
} from '@/types'

export const qualityApi = {
  // Dashboard
  dashboard: () =>
    apiClient.get<QualityDashboard[]>('/quality/dashboard/').then(r => r.data[0] ?? null),

  // Processes
  processes: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<QualityProcess>>('/quality/processes/', { params }).then(r => r.data),

  process: (id: string) =>
    apiClient.get<QualityProcess>(`/quality/processes/${id}/`).then(r => r.data),

  createProcess: (data: Partial<QualityProcess>) =>
    apiClient.post<QualityProcess>('/quality/processes/', data).then(r => r.data),

  updateProcess: (id: string, data: Partial<QualityProcess>) =>
    apiClient.patch<QualityProcess>(`/quality/processes/${id}/`, data).then(r => r.data),

  // Documents
  documents: (processId: string) =>
    apiClient.get<PaginatedResponse<QualityDocument>>('/quality/documents/', {
      params: { process: processId },
    }).then(r => r.data),

  document: (processId: string, docId: string) =>
    apiClient.get<QualityDocument>(`/quality/processes/${processId}/documents/${docId}/`).then(r => r.data),

  createDocument: (data: Partial<QualityDocument> | FormData) =>
    apiClient.post<QualityDocument>('/quality/documents/', data).then(r => r.data),

  updateDocument: (processId: string, docId: string, data: Partial<QualityDocument>) =>
    apiClient.patch<QualityDocument>(`/quality/processes/${processId}/documents/${docId}/`, data).then(r => r.data),

  deleteDocument: (processId: string, docId: string) =>
    apiClient.delete(`/quality/processes/${processId}/documents/${docId}/`),

  approveDocument: (processId: string, docId: string, data: { approved_by: string }) =>
    apiClient.post(`/quality/processes/${processId}/documents/${docId}/approve/`, data).then(r => r.data),

  // Audits
  audits: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<InternalAudit>>('/quality/audits/', { params }).then(r => r.data),

  audit: (id: string) =>
    apiClient.get<InternalAudit>(`/quality/audits/${id}/`).then(r => r.data),

  // Nonconformities
  nonconformities: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<NonConformity>>('/quality/nonconformities/', { params }).then(r => r.data),

  nonconformity: (id: string) =>
    apiClient.get<NonConformity>(`/quality/nonconformities/${id}/`).then(r => r.data),

  createNonconformity: (data: Partial<NonConformity>) =>
    apiClient.post<NonConformity>('/quality/nonconformities/', data).then(r => r.data),

  updateNonconformity: (id: string, data: Partial<NonConformity>) =>
    apiClient.patch<NonConformity>(`/quality/nonconformities/${id}/`, data).then(r => r.data),
}
