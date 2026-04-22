import apiClient from './client'
import type {
  PaginatedResponse, HiringProcess, Candidate, EmployeeOnboarding,
} from '@/types'

export const hiringApi = {
  // Processes
  processes: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<HiringProcess>>('/hiring/processes/', { params }).then(r => r.data),

  process: (id: string) =>
    apiClient.get<HiringProcess>(`/hiring/processes/${id}/`).then(r => r.data),

  createProcess: (data: Partial<HiringProcess>) =>
    apiClient.post<HiringProcess>('/hiring/processes/', data).then(r => r.data),

  updateProcess: (id: string, data: Partial<HiringProcess>) =>
    apiClient.patch<HiringProcess>(`/hiring/processes/${id}/`, data).then(r => r.data),

  // Candidates
  candidates: (processId: string) =>
    apiClient.get<PaginatedResponse<Candidate>>('/hiring/candidates/', {
      params: { hiring_process: processId },
    }).then(r => r.data),

  candidate: (processId: string, candidateId: string) =>
    apiClient.get<Candidate>(`/hiring/processes/${processId}/candidates/${candidateId}/`).then(r => r.data),

  createCandidate: (processId: string, data: Partial<Candidate>) =>
    apiClient.post<Candidate>(`/hiring/processes/${processId}/candidates/`, data).then(r => r.data),

  updateCandidate: (processId: string, candidateId: string, data: Partial<Candidate>) =>
    apiClient.patch<Candidate>(
      `/hiring/processes/${processId}/candidates/${candidateId}/`,
      data,
    ).then(r => r.data),

  hireCandidate: (processId: string, candidateId: string, data: { document_type: number; document_number: number }) =>
    apiClient.post(`/hiring/processes/${processId}/candidates/${candidateId}/hire/`, data).then(r => r.data),

  // Onboarding
  onboarding: (employeeId: string) =>
    apiClient.get<EmployeeOnboarding[]>(`/personnel/employees/${employeeId}/onboarding/`).then(r => r.data),

  completeTask: (employeeId: string, onboardingId: string, taskId: string, data: { completed_by: string; notes: string }) =>
    apiClient.patch(
      `/personnel/employees/${employeeId}/onboarding/${onboardingId}/tasks/${taskId}/complete/`,
      data,
    ).then(r => r.data),
}
