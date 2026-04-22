import apiClient from './client'
import type { PaginatedResponse, TenantAdmin, TenantModuleConfig } from '@/types'

async function unwrapList<T>(p: Promise<{ data: PaginatedResponse<T> | T[] }>): Promise<T[]> {
  const { data } = await p
  if (Array.isArray(data)) return data
  return data.results ?? []
}

export interface Country {
  id: number
  name: string
  iso_code: string
}

export interface City {
  id: number
  name: string
  code: string
  state_province: number
}

export interface SocialSecurityEntity {
  id: number
  code: string
  nit: string
  name: string
  entity_type: string
  sgp_code: string
}

export const tenantsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<TenantAdmin>>('/tenants/', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<TenantAdmin>(`/tenants/${id}/`).then((r) => r.data),

  /** @alias get */
  getTenant: (id: string) =>
    apiClient.get<TenantAdmin>(`/tenants/${id}/`).then((r) => r.data),

  create: (data: Partial<TenantAdmin> | Record<string, unknown>) =>
    apiClient.post<TenantAdmin>('/tenants/', data).then((r) => r.data),

  createTenant: (data: FormData | Partial<TenantAdmin> | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return apiClient.post<TenantAdmin>('/tenants/', data).then((r) => r.data)
    }
    return apiClient.post<TenantAdmin>('/tenants/', data).then((r) => r.data)
  },

  createForm: (data: FormData) =>
    apiClient.post<TenantAdmin>('/tenants/', data).then((r) => r.data),

  update: (id: string, data: Partial<TenantAdmin> | Record<string, unknown>) =>
    apiClient.patch<TenantAdmin>(`/tenants/${id}/`, data as Record<string, unknown>).then((r) => r.data),

  updateTenant: (id: string, data: FormData | Partial<TenantAdmin> | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return apiClient.patch<TenantAdmin>(`/tenants/${id}/`, data).then((r) => r.data)
    }
    return apiClient.patch<TenantAdmin>(`/tenants/${id}/`, data).then((r) => r.data)
  },

  updateForm: (id: string, data: FormData) =>
    apiClient.patch<TenantAdmin>(`/tenants/${id}/`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/tenants/${id}/`),

  getModules: (id: string) =>
    apiClient.get<TenantModuleConfig>(`/tenants/${id}/modules/`).then((r) => r.data),

  updateModules: (id: string, data: Partial<TenantModuleConfig>) =>
    apiClient.patch<TenantModuleConfig>(`/tenants/${id}/modules/`, data).then((r) => r.data),

  updateTenantModules: (id: string, data: Partial<TenantModuleConfig>) =>
    apiClient.patch<TenantModuleConfig>(`/tenants/${id}/modules/`, data).then((r) => r.data),

  /** Catálogos: la API ahora acepta ?page_size= (hasta 5000). `search` filtra en servidor (SearchFilter DRF). */
  getCountries: (params?: { search?: string; page_size?: string }) =>
    unwrapList<Country>(
      apiClient.get('/catalogs/countries/', {
        params: { page_size: '3000', ...params } as Record<string, string>,
      }),
    ),

  getCities: (countryId: number, params?: { search?: string; page_size?: string }) =>
    unwrapList<City>(
      apiClient.get('/catalogs/cities/', {
        params: {
          country: String(countryId),
          page_size: '5000',
          ...params,
        } as Record<string, string>,
      }),
    ),

  getARLs: () =>
    unwrapList<SocialSecurityEntity>(
      apiClient.get('/catalogs/social-security-entities/', { params: { type: 'ARL', page_size: '200' } }),
    ),
}
