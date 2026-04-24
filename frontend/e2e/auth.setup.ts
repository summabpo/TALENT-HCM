/**
 * Auth setup — login programático via API (evita problemas con React controlled selects).
 * 1. POST /auth/login/ sin tenant_id → lista de tenants
 * 2. POST /auth/login/ con tenant_id del slug preferido → tokens
 * 3. Escribe tokens en localStorage, navega a "/" y espera que cargue
 * 4. Guarda storageState para los tests
 */
import { test as setup, expect } from '@playwright/test'

const ADMIN_FILE = 'e2e/.auth/admin.json'
const SUPERADMIN_FILE = 'e2e/.auth/superadmin.json'
const API_BASE = 'http://localhost:8001/api/v1'

async function programmaticLogin(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  preferSlug = 'demo',
) {
  // Step 1: get tenant list
  const step1 = await page.request.post(`${API_BASE}/auth/login/`, {
    data: { email, password },
    failOnStatusCode: false,
  })
  const body1 = await step1.json() as {
    access?: string
    tenant_required?: boolean
    tenants?: { id: string; slug: string; name: string }[]
  }

  let tenantId: string | undefined

  if (body1.tenant_required && body1.tenants?.length) {
    const preferred = body1.tenants.find(t => t.slug === preferSlug) ?? body1.tenants[body1.tenants.length - 1]
    tenantId = preferred?.id
  } else if (body1.access) {
    // Single-tenant login — set tokens before navigating to protected route
    await page.goto('/login')
    await page.evaluate(({ access, refresh }: { access: string; refresh?: string }) => {
      localStorage.setItem('talent_access', access)
      if (refresh) localStorage.setItem('talent_refresh', refresh)
    }, body1 as { access: string; refresh?: string })
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    if (page.url().includes('/login')) {
      throw new Error(`Auth failed for single-tenant login: redirected to ${page.url()}`)
    }
    return
  }

  // Step 2: login with tenant_id
  const step2 = await page.request.post(`${API_BASE}/auth/login/`, {
    data: { email, password, ...(tenantId ? { tenant_id: tenantId } : {}) },
    failOnStatusCode: false,
  })
  const tokens = await step2.json() as { access: string; refresh?: string }

  if (!tokens.access) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(tokens)}`)
  }

  // Step 3: land on any page first so we have a browsing context, then set tokens
  await page.goto('/login')
  await page.evaluate(({ access, refresh }: { access: string; refresh?: string }) => {
    localStorage.setItem('talent_access', access)
    if (refresh) localStorage.setItem('talent_refresh', refresh)
  }, tokens)

  // Step 4: navigate to "/" so ProtectedLayout picks up the tokens via AuthContext
  await page.goto('/')
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
  if (page.url().includes('/login')) {
    throw new Error(`Auth failed: /auth/me/ rejected tokens, redirected to ${page.url()}`)
  }
}

setup('autenticar como admin de tenant', async ({ page }) => {
  await programmaticLogin(page, 'admin@demo.co', 'admin1234', 'demo')
  await expect(page.getByText('Demo Company').first()).toBeVisible()
  await page.context().storageState({ path: ADMIN_FILE })
})

setup('autenticar como superadmin de plataforma', async ({ page }) => {
  const reached = await programmaticLogin(page, 'superadmin@summabpo.com', 'Summa2026$', 'demo')
    .then(() => true)
    .catch(() => false)

  if (!reached) {
    console.warn('[SETUP] superadmin@summabpo.com no existe — usando admin@demo.co como fallback')
    await programmaticLogin(page, 'admin@demo.co', 'admin1234', 'demo')
  }

  await page.context().storageState({ path: SUPERADMIN_FILE })
})
