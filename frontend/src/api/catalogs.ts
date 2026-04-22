import apiClient from './client'
import type {
  PaginatedResponse,
  OrganizationalLevel,
  CatalogPosition,
  CostCenter,
  SubCostCenter,
  WorkLocation,
  WorkCenter,
  AdminCountry,
  AdminStateProvince,
  AdminCity,
  AdminDocumentType,
  AdminBank,
  AdminSocialSecurityEntity,
  CatalogProfession,
  CatalogDocumentType,
} from '@/types'

async function unwrapList<T>(p: Promise<{ data: PaginatedResponse<T> | T[] }>): Promise<T[]> {
  const { data } = await p
  if (Array.isArray(data)) return data
  return data.results ?? []
}

function tenantCrud<T>(basePath: string) {
  return {
    list: (params?: Record<string, string>) =>
      unwrapList<T>(apiClient.get(basePath, { params })),
    get: (id: string) => apiClient.get<T>(`${basePath}${id}/`).then((r) => r.data),
    create: (body: Record<string, unknown>) =>
      apiClient.post<T>(basePath, body).then((r) => r.data),
    update: (id: string, body: Record<string, unknown>) =>
      apiClient.patch<T>(`${basePath}${id}/`, body).then((r) => r.data),
    delete: (id: string) => apiClient.delete(`${basePath}${id}/`),
  }
}

export const organizationalLevelsApi = tenantCrud<OrganizationalLevel>('/catalogs/organizational-levels/')
export const catalogPositionsApi = tenantCrud<CatalogPosition>('/catalogs/positions/')
export const costCentersApi = tenantCrud<CostCenter>('/catalogs/cost-centers/')
export const subCostCentersApi = tenantCrud<SubCostCenter>('/catalogs/sub-cost-centers/')
export const workLocationsApi = tenantCrud<WorkLocation>('/catalogs/work-locations/')
export const workCentersApi = tenantCrud<WorkCenter>('/catalogs/work-centers/')

export interface ContractTypeItem {
  id: number
  name: string
  dian_code: number | null
}

export interface SalaryTypeItem {
  id: number
  name: string
}

export interface PositionItem {
  id: string
  name: string
  level: string
}

export interface WorkCenterItem {
  id: string
  name: string
}

export interface SocialSecurityEntityItem {
  id: number
  code: string
  nit: string
  name: string
  entity_type: string
}

export interface ContributorTypeItem {
  code: string
  description: string
  form_code: number | null
}

// Global catalog CRUD for staff/admin users — returns paginated responses
function globalCatalogCrud<T>(basePath: string) {
  return {
    list: (params?: Record<string, string>) =>
      apiClient
        .get<PaginatedResponse<T>>(basePath, { params })
        .then((r) => r.data),
    get: (id: number) =>
      apiClient.get<T>(`${basePath}${id}/`).then((r) => r.data),
    create: (body: Record<string, unknown>) =>
      apiClient.post<T>(basePath, body).then((r) => r.data),
    update: (id: number, body: Record<string, unknown>) =>
      apiClient.patch<T>(`${basePath}${id}/`, body).then((r) => r.data),
    // Soft-delete: sets is_active=false via destroy (backend overrides perform_destroy)
    deactivate: (id: number) =>
      apiClient.patch<T>(`${basePath}${id}/`, { is_active: false }).then((r) => r.data),
    activate: (id: number) =>
      apiClient.patch<T>(`${basePath}${id}/`, { is_active: true }).then((r) => r.data),
  }
}

export const adminCountriesApi = globalCatalogCrud<AdminCountry>('/catalogs/countries/')
export const adminStatesApi = globalCatalogCrud<AdminStateProvince>('/catalogs/states/')
export const adminCitiesApi = globalCatalogCrud<AdminCity>('/catalogs/cities/')
export const adminDocumentTypesApi = globalCatalogCrud<AdminDocumentType>('/catalogs/document-types/')
export const adminBanksApi = globalCatalogCrud<AdminBank>('/catalogs/banks/')
export const adminSocialSecurityApi = globalCatalogCrud<AdminSocialSecurityEntity>(
  '/catalogs/social-security-entities/',
)

export const catalogsApi = {
  contractTypes: () =>
    unwrapList<ContractTypeItem>(apiClient.get('/catalogs/contract-types/')),

  salaryTypes: () =>
    unwrapList<SalaryTypeItem>(apiClient.get('/catalogs/salary-types/')),

  positions: () =>
    unwrapList<PositionItem>(apiClient.get('/catalogs/positions/')),

  workCenters: () =>
    unwrapList<WorkCenterItem>(apiClient.get('/catalogs/work-centers/')),

  socialSecurityByType: (type: 'EPS' | 'AFP' | 'CCF' | 'CESANTIAS') =>
    unwrapList<SocialSecurityEntityItem>(
      apiClient.get('/catalogs/social-security-entities/', { params: { type } }),
    ),

  contributorTypes: () =>
    unwrapList<ContributorTypeItem>(apiClient.get('/catalogs/contributor-types/')),

  professions: () =>
    unwrapList<CatalogProfession>(
      apiClient.get('/catalogs/professions/', { params: { page_size: '2000' } }),
    ),

  documentTypes: () =>
    unwrapList<CatalogDocumentType>(
      apiClient.get('/catalogs/document-types/', { params: { page_size: '500' } }),
    ),
}
