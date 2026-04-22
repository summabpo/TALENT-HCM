import { Page, expect } from '@playwright/test'

export const ADMIN_STATE = 'e2e/.auth/admin.json'
export const SUPERADMIN_STATE = 'e2e/.auth/superadmin.json'

export const ADMIN_EMAIL = 'admin@demo.co'
export const ADMIN_PASSWORD = 'admin1234'
export const SUPERADMIN_EMAIL = 'superadmin@talentsumma.co'
export const SUPERADMIN_PASSWORD = 'Super1234!'

/** Login desde la UI y opcionalmente seleccionar empresa. */
export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('correo@empresa.com').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  const tenantSelect = page.getByLabel('Selecciona empresa')
  if (await tenantSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await tenantSelect.selectOption({ label: 'Demo Company' })
    await page.getByRole('button', { name: 'Ingresar' }).click()
  }

  await page.waitForURL('/', { timeout: 10_000 })
}

export async function loginAsSuperAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('correo@empresa.com').fill(SUPERADMIN_EMAIL)
  await page.getByPlaceholder('••••••••').fill(SUPERADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL('/', { timeout: 10_000 })
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL('/login')
}
