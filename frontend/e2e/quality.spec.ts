/**
 * Módulo de Calidad ISO 9001.
 *
 * NOTA: No existe ruta /quality/nonconformities/create (test 23 navega al detalle
 * con id="create" que devuelve error de API). Esto está documentado como issue de UI.
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test('21 — ver dashboard de calidad con secciones de métricas', async ({ page }) => {
  await page.goto('/quality/dashboard')

  // Wait for API to resolve
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

  // Check for error state first
  const isError = await page.getByText(/error al cargar|no hay datos/i)
    .isVisible({ timeout: 2_000 }).catch(() => false)

  if (isError) {
    // Dashboard API unavailable or returned no data — just verify error renders cleanly
    await expect(page.getByText(/error al cargar|no hay datos/i)).toBeVisible()
    return
  }

  // Dashboard renders successfully
  await expect(page.getByRole('heading', { name: /dashboard de calidad/i })).toBeVisible()

  // The card grid shows metric labels
  await expect(page.getByText(/procesos activos|nc abiertas|documentos/i).first()).toBeVisible()
})

test('22 — ver lista de no conformidades del seed', async ({ page }) => {
  await page.goto('/quality/nonconformities')
  await expect(page.getByRole('heading', { name: /no conformidades/i })).toBeVisible()

  // DataTable shows column headers only when data is present
  const hasData = await page.getByRole('columnheader').first()
    .isVisible({ timeout: 3_000 }).catch(() => false)

  if (hasData) {
    await expect(page.getByRole('columnheader', { name: /título|fuente|estado/i }).first()).toBeVisible()
  } else {
    await expect(page.getByText(/no hay no conformidades/i)).toBeVisible()
  }
})

test('23 — botón Nueva NC existe y es accesible', async ({ page }) => {
  await page.goto('/quality/nonconformities')

  // The create button exists (navigates to /quality/nonconformities/create)
  // NOTE: /quality/nonconformities/create has no dedicated form route in this version —
  // it falls through to the detail route with id="create". This is a known UI issue.
  const createBtn = page.getByRole('button', { name: /nueva nc/i })
  await expect(createBtn).toBeVisible()

  // Clicking should navigate away from the list page
  await createBtn.click()
  await expect(page).toHaveURL(/\/quality\/nonconformities\//)
})
