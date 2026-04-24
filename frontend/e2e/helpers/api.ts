import { APIRequestContext } from '@playwright/test'

const API_BASE = 'http://localhost:8001/api/v1'

async function getAdminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login/`, {
    data: { email: 'admin@demo.co', password: 'admin1234' },
  })
  const body = await res.json()

  // Si requiere selección de tenant, re-intentar con el primer tenant
  if (body.tenant_required && body.tenants?.length > 0) {
    const tenant = body.tenants.find((t: { name: string; id: string }) =>
      t.name === 'Demo Company'
    ) ?? body.tenants[0]
    const res2 = await request.post(`${API_BASE}/auth/login/`, {
      data: { email: 'admin@demo.co', password: 'admin1234', tenant_id: tenant.id },
    })
    const body2 = await res2.json()
    return body2.access as string
  }
  return body.access as string
}

async function getSuperAdminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login/`, {
    data: { email: 'superadmin@summabpo.com', password: 'Summa2026$' },
  })
  const body = await res.json()
  return body.access as string
}

/** Crea un empleado mínimo vía API y devuelve su id. */
export async function createEmployeeViaApi(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const token = await getAdminToken(request)
  const res = await request.post(`${API_BASE}/personnel/employees/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      document_type: 1,
      document_number: Math.floor(Math.random() * 9_000_000) + 1_000_000,
      first_name: 'Test',
      first_last_name: 'E2E',
      email: `e2e-${Date.now()}@test.co`,
      ...overrides,
    },
  })
  const body = await res.json()
  return body.id as string
}

/** Crea un proceso de hiring vía API y devuelve su id. */
export async function createHiringProcessViaApi(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const token = await getAdminToken(request)
  const res = await request.post(`${API_BASE}/hiring/processes/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      position_title: 'Cargo E2E Test',
      requested_by: 'E2E Runner',
      positions_count: 1,
      ...overrides,
    },
  })
  const body = await res.json()
  return body.id as string
}

/** Crea una no conformidad vía API y devuelve su id. */
export async function createNonConformityViaApi(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const token = await getAdminToken(request)
  const res = await request.post(`${API_BASE}/quality/nonconformities/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      code: `NC-E2E-${Date.now()}`,
      source: 'process',
      description: 'No conformidad creada por test E2E',
      detected_date: new Date().toISOString().split('T')[0],
      ...overrides,
    },
  })
  const body = await res.json()
  return body.id as string
}

export { getAdminToken, getSuperAdminToken }
