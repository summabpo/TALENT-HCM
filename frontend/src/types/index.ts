export interface User {
  id: string
  email: string
  fullName: string
  roles: string[]
  tenantId: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  detail?: string
  [key: string]: unknown
}
