/**
 * Tests de autenticación — sin estado persistido; browser fresco en cada test.
 *
 * NOTA sobre test 2: el seed solo crea admin@demo.co con is_superuser=true y
 * membresía a Demo Company. El flujo "superadmin sin tenant" (sidebar solo admin)
 * requiere un usuario sin UserTenant activo. Se verifica la variante que sí existe.
 *
 * NOTA sobre selección de tenant: si admin@demo.co tiene múltiples membresías activas
 * (p.ej. demo y demo2), el login vía UI muestra un select con opciones idénticas.
 * Interceptamos la petición para auto-seleccionar el slug 'demo' y evitar fragilidad
 * en el select controlado de React 18.
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

const PREFER_SLUG = 'demo'

/**
 * Installs a route interceptor that auto-resolves multi-tenant login:
 * when /auth/login/ returns tenant_required, it makes a second call with
 * the preferred tenant UUID and returns those tokens to the UI.
 * The form never shows the select — it lands directly at "/".
 */
async function interceptLoginToAutoSelectTenant(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/login/', async (route, request) => {
    const body = request.postDataJSON() as Record<string, string>
    if (body.tenant_id) {
      // Second call already has tenant — pass through
      await route.continue()
      return
    }
    const res = await page.request.fetch(request)
    const json = await res.json() as {
      tenant_required?: boolean
      tenants?: { id: string; slug: string }[]
      access?: string
    }
    if (json.tenant_required && json.tenants?.length) {
      const preferred = json.tenants.find(t => t.slug === PREFER_SLUG) ?? json.tenants[0]
      const loginRes = await page.request.post(request.url(), {
        data: { ...body, tenant_id: preferred.id },
        failOnStatusCode: false,
      })
      await route.fulfill({ response: loginRes })
    } else {
      await route.fulfill({ response: res })
    }
  })
}

test('1 — login exitoso como admin de tenant muestra Demo Company', async ({ page }) => {
  await interceptLoginToAutoSelectTenant(page)
  await page.goto('/login')
  await page.getByPlaceholder('correo@empresa.com').fill('admin@demo.co')
  await page.getByPlaceholder('••••••••').fill('admin1234')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL('/', { timeout: 10_000 })
  await expect(page.getByText('Demo Company').first()).toBeVisible()
})

test('2 — admin con is_superuser ve módulos operativos Y sección de administración', async ({ page }) => {
  // admin@demo.co tiene is_superuser=true y tenant → ve todo el sidebar
  await interceptLoginToAutoSelectTenant(page)
  await page.goto('/login')
  await page.getByPlaceholder('correo@empresa.com').fill('admin@demo.co')
  await page.getByPlaceholder('••••••••').fill('admin1234')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await page.waitForURL('/', { timeout: 10_000 })

  // Scope to sidebar nav to avoid strict-mode conflicts with dashboard card links
  const sidebarNav = page.locator('aside nav')

  // Módulos operativos visibles (tiene tenant)
  await expect(sidebarNav.getByRole('link', { name: 'Personal', exact: true })).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Contratación', exact: true })).toBeVisible()

  // Sección de administración visible (is_staff=true)
  await expect(sidebarNav.getByRole('link', { name: 'Empresas', exact: true })).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Catálogos globales', exact: true })).toBeVisible()
})

test('3 — login fallido con contraseña incorrecta muestra error', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('correo@empresa.com').fill('admin@demo.co')
  await page.getByPlaceholder('••••••••').fill('contraseña-incorrecta-9999')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page.getByText(/incorrectos|inválido|credentials/i)).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('4 — logout redirige a /login', async ({ page }) => {
  await interceptLoginToAutoSelectTenant(page)
  await page.goto('/login')
  await page.getByPlaceholder('correo@empresa.com').fill('admin@demo.co')
  await page.getByPlaceholder('••••••••').fill('admin1234')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await page.waitForURL('/', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL('/login')
})

test('5 — ruta protegida sin autenticación redirige a /login', async ({ page }) => {
  await page.goto('/personnel/employees')
  await expect(page).toHaveURL('/login')
})
