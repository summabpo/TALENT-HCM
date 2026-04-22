import { createContext, useContext, ReactNode } from 'react'
import type { Tenant } from '@/types'

interface TenantContextValue {
  tenant: Tenant | null
}

const TenantContext = createContext<TenantContextValue>({ tenant: null })

export function TenantProvider({ tenant, children }: { tenant: Tenant | null | undefined; children: ReactNode }) {
  return <TenantContext.Provider value={{ tenant: tenant ?? null }}>{children}</TenantContext.Provider>
}

export const useTenant = () => useContext(TenantContext)
