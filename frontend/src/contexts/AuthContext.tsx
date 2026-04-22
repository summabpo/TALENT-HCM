import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { Tenant, TenantModules, User } from '@/types'
import apiClient, { tokenStorage } from '@/api/client'

interface LoginPayload {
  email: string
  password: string
  tenant_id?: string
}

interface LoginResult {
  tenant_required?: boolean
  tenants?: Tenant[]
}

interface AuthContextValue {
  user: User | null
  tenant: Tenant | null
  modules: TenantModules | null
  loading: boolean
  login: (payload: LoginPayload) => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  tenant: null,
  modules: null,
  loading: true,
  login: async () => ({}),
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [modules, setModules] = useState<TenantModules | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = (data: { user: User; tenant: Tenant; modules: TenantModules }) => {
    setUser(data.user)
    setTenant(data.tenant)
    setModules(data.modules)
  }

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      setLoading(false)
      return
    }
    apiClient.get<{ user: User; tenant: Tenant; modules: TenantModules }>('/auth/me/')
      .then((res) => applySession(res.data))
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (payload: LoginPayload): Promise<LoginResult> => {
    const res = await apiClient.post('/auth/login/', payload)
    const data = res.data
    if (data.tenant_required) {
      return { tenant_required: true, tenants: data.tenants }
    }
    tokenStorage.set(data.access, data.refresh)
    applySession(data)
    return {}
  }, [])

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh()
    if (refresh) {
      await apiClient.post('/auth/logout/', { refresh }).catch(() => {})
    }
    tokenStorage.clear()
    setUser(null)
    setTenant(null)
    setModules(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, tenant, modules, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

/** Superusuario Django: CRUD de catálogos globales; tenants y staff sin flag solo leen en /admin/catalogs/. */
export function useGlobalCatalogWriteAccess(): boolean {
  const { user } = useAuth()
  return user?.is_superuser === true
}
