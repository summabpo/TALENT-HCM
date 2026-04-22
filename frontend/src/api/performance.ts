import apiClient from './client'
import type {
  PaginatedResponse, OKRPeriod, Objective, KeyResult,
  KPI, KPIMeasurement, PerformanceDashboard,
} from '@/types'

export const performanceApi = {
  // Dashboard
  dashboard: () =>
    apiClient.get<PerformanceDashboard[]>('/performance/dashboard/').then(r => r.data[0] ?? null),

  // Periods
  periods: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<OKRPeriod>>('/performance/periods/', { params }).then(r => r.data),

  period: (id: string) =>
    apiClient.get<OKRPeriod>(`/performance/periods/${id}/`).then(r => r.data),

  createPeriod: (data: Partial<OKRPeriod>) =>
    apiClient.post<OKRPeriod>('/performance/periods/', data).then(r => r.data),

  updatePeriod: (id: string, data: Partial<OKRPeriod>) =>
    apiClient.patch<OKRPeriod>(`/performance/periods/${id}/`, data).then(r => r.data),

  // Objectives
  objectives: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Objective>>('/performance/objectives/', { params }).then(r => r.data),

  periodObjectives: (periodId: string) =>
    apiClient.get<Objective[]>(`/performance/periods/${periodId}/objectives/`).then(r => r.data),

  objective: (id: string) =>
    apiClient.get<Objective>(`/performance/objectives/${id}/`).then(r => r.data),

  createObjective: (periodId: string, data: Partial<Objective>) =>
    apiClient.post<Objective>(`/performance/periods/${periodId}/objectives/`, data).then(r => r.data),

  updateObjective: (id: string, data: Partial<Objective>) =>
    apiClient.patch<Objective>(`/performance/objectives/${id}/`, data).then(r => r.data),

  // Key Results
  keyResults: (objectiveId: string) =>
    apiClient.get<KeyResult[]>(`/performance/objectives/${objectiveId}/key-results/`).then(r => r.data),

  updateKeyResult: (id: string, data: Partial<KeyResult>) =>
    apiClient.patch<KeyResult>(`/performance/key-results/${id}/`, data).then(r => r.data),

  postKRUpdate: (krId: string, data: { new_value: string; updated_by: string; comment: string }) =>
    apiClient.post(`/performance/key-results/${krId}/updates/`, data).then(r => r.data),

  // KPIs
  kpis: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<KPI>>('/performance/kpis/', { params }).then(r => r.data),

  kpi: (id: string) =>
    apiClient.get<KPI>(`/performance/kpis/${id}/`).then(r => r.data),

  createKPI: (data: Partial<KPI>) =>
    apiClient.post<KPI>('/performance/kpis/', data).then(r => r.data),

  updateKPI: (id: string, data: Partial<KPI>) =>
    apiClient.patch<KPI>(`/performance/kpis/${id}/`, data).then(r => r.data),

  // Measurements
  measurements: (kpiId: string) =>
    apiClient.get<KPIMeasurement[]>(`/performance/kpis/${kpiId}/measurements/`).then(r => r.data),

  addMeasurement: (kpiId: string, data: Partial<KPIMeasurement>) =>
    apiClient.post<KPIMeasurement>(`/performance/kpis/${kpiId}/measurements/`, data).then(r => r.data),

  deleteMeasurement: (kpiId: string, measurementId: string) =>
    apiClient.delete(`/performance/kpis/${kpiId}/measurements/${measurementId}/`),
}
