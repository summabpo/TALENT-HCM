import apiClient from './client'
import type {
  PaginatedResponse, Department, EmployeeList, Employee,
  Contract, EmployeeDocument,
} from '@/types'

export const personnelApi = {
  // Departments
  departments: () =>
    apiClient.get<PaginatedResponse<Department>>('/personnel/departments/').then(r => r.data),

  // Employees
  employees: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<EmployeeList>>('/personnel/employees/', { params }).then(r => r.data),

  employee: (id: string) =>
    apiClient.get<Employee>(`/personnel/employees/${id}/`).then(r => r.data),

  createEmployee: (data: Partial<Employee>) =>
    apiClient.post<Employee>('/personnel/employees/', data).then(r => r.data),

  updateEmployee: (id: string, data: Partial<Employee>) =>
    apiClient.patch<Employee>(`/personnel/employees/${id}/`, data).then(r => r.data),

  createEmployeeForm: (formData: FormData) =>
    apiClient
      .post<Employee>('/personnel/employees/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  updateEmployeeForm: (id: string, formData: FormData) =>
    apiClient
      .patch<Employee>(`/personnel/employees/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  // Contracts
  contracts: (employeeId: string) =>
    apiClient.get<Contract[]>(`/personnel/employees/${employeeId}/contracts/`).then(r => r.data),

  contract: (employeeId: string, contractId: string) =>
    apiClient.get<Contract>(`/personnel/employees/${employeeId}/contracts/${contractId}/`).then(r => r.data),

  createContract: (employeeId: string, data: Partial<Contract>) =>
    apiClient.post<Contract>(`/personnel/employees/${employeeId}/contracts/`, data).then(r => r.data),

  updateContract: (employeeId: string, contractId: string, data: Partial<Contract>) =>
    apiClient.patch<Contract>(`/personnel/employees/${employeeId}/contracts/${contractId}/`, data).then(r => r.data),

  deleteContract: (employeeId: string, contractId: string) =>
    apiClient.delete(`/personnel/employees/${employeeId}/contracts/${contractId}/`),

  // Documents
  documents: (employeeId: string) =>
    apiClient.get<EmployeeDocument[]>(`/personnel/employees/${employeeId}/documents/`).then(r => r.data),

  uploadDocument: (employeeId: string, formData: FormData) =>
    apiClient.post<EmployeeDocument>(`/personnel/employees/${employeeId}/documents/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  deleteDocument: (employeeId: string, docId: string) =>
    apiClient.delete(`/personnel/employees/${employeeId}/documents/${docId}/`),
}
