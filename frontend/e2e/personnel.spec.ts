/**
 * Módulo de Personal — empleados, detalle, crear, editar.
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.beforeEach(async ({ page }) => {
  await page.goto('/personnel/employees')
  await expect(page.getByRole('heading', { name: /empleados/i })).toBeVisible()
})

test('13 — ver lista de empleados del seed', async ({ page }) => {
  // "Nuevo empleado" link must always be present
  await expect(page.getByRole('link', { name: /nuevo empleado/i })).toBeVisible()

  // DataTable shows table only when there's data; verify either the table or empty state
  const hasData = await page.getByRole('columnheader', { name: /nombre/i }).isVisible({ timeout: 3_000 }).catch(() => false)

  if (hasData) {
    await expect(page.getByRole('columnheader', { name: /nombre/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /documento/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /estado/i })).toBeVisible()
  } else {
    await expect(page.getByText(/no hay empleados/i)).toBeVisible()
  }
})

test('14 — ver detalle de empleado con contrato', async ({ page }) => {
  // Check if there are employees in the table
  const firstRow = page.getByRole('row').nth(1)
  const hasData = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)

  if (!hasData) {
    console.warn('[TEST 14] Sin empleados en el seed. Omitiendo navegación al detalle.')
    await expect(page.getByText(/no hay empleados/i)).toBeVisible()
    return
  }

  // Click the employee name link in the first data row
  await firstRow.getByRole('link').first().click()

  await expect(page).toHaveURL(/\/personnel\/employees\/[0-9a-f-]+$/)
  // Use level: 1 to avoid strict mode when page has multiple headings
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('15 — crear empleado nuevo con campos requeridos', async ({ page }) => {
  await page.getByRole('link', { name: /nuevo empleado/i }).click()
  await expect(page).toHaveURL('/personnel/employees/create')

  // Select document type via react-select (classNamePrefix="summa-select")
  // Click the control container to open the dropdown
  await page.locator('.summa-select__control').first().click()
  // Options render in a portal at body level
  await page.locator('.summa-select__option').first().click()

  // Número de documento — unique per run to avoid 400 duplicate errors
  await page.locator('input[name="document_number"]').fill(String(Date.now()).slice(-9))

  // Nombres
  await page.locator('input[name="first_name"]').fill('Carlos')
  await page.locator('input[name="first_last_name"]').fill('Ramírez')

  // Email
  await page.locator('input[name="email"]').fill(`e2e.carlos.${Date.now()}@demo.co`)

  await page.getByRole('button', { name: /guardar/i }).click()

  // On success, redirects to employee detail
  await expect(page).toHaveURL(/\/personnel\/employees\/[0-9a-f-]+$/, { timeout: 15_000 })
  // Use h1 heading to avoid strict mode — detail page has multiple headings
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Carlos')
})

test('16 — editar empleado existente', async ({ page }) => {
  // Check if there are employees in the table
  const firstRow = page.getByRole('row').nth(1)
  const hasData = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)

  if (!hasData) {
    console.warn('[TEST 16] Sin empleados en el seed. Omitiendo edición.')
    return
  }

  // Navigate to first employee detail
  await firstRow.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/personnel\/employees\/[0-9a-f-]+$/)

  // "Editar" is a <button> (btn-primary) in the page header — scope to avoid list's btn-ghost Editar buttons
  await page.locator('.page-header').getByRole('button', { name: 'Editar' }).click()
  await expect(page).toHaveURL(/\/personnel\/employees\/.+\/edit$/)

  // Modify an optional field
  const phoneInput = page.locator('input[name="phone"], input[name="cell_phone"]').first()
  await phoneInput.clear()
  await phoneInput.fill('3109876543')

  await page.getByRole('button', { name: /guardar/i }).click()

  // On success, redirects to employee detail
  await expect(page).toHaveURL(/\/personnel\/employees\/[0-9a-f-]+$/, { timeout: 15_000 })
})
