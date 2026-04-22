/**
 * Módulo de Desempeño — OKRs y KPIs.
 *
 * NOTA: OKRPeriodListPage usa tarjetas (grid de cards), no tabla.
 * KPIListPage usa DataTable (tabla real con column headers).
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test('24 — ver lista de períodos OKR', async ({ page }) => {
  await page.goto('/performance/periods')
  await expect(page.getByRole('heading', { name: /periodos okr/i })).toBeVisible()

  // "Nuevo periodo" button must always be visible
  await expect(page.getByRole('button', { name: /nuevo periodo/i })).toBeVisible()

  // Periods render as cards (not a table — no column headers).
  // Check for either period cards or empty state.
  const hasCards = await page.getByRole('link', { name: /ver okrs/i }).first()
    .isVisible({ timeout: 3_000 }).catch(() => false)

  if (hasCards) {
    // Period cards have h3 headings with period names
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /ver okrs/i }).first()).toBeVisible()
  } else {
    await expect(page.getByText(/no hay periodos/i)).toBeVisible()
  }
})

test('25 — ver dashboard OKR con árbol de objetivos', async ({ page }) => {
  await page.goto('/performance/periods')

  // Navigate to the dashboard of the first active period
  const dashboardLink = page.getByRole('link', { name: /ver okrs/i }).first()
  const hasPeriod = await dashboardLink.isVisible({ timeout: 3_000 }).catch(() => false)

  if (hasPeriod) {
    await dashboardLink.click()
    await expect(page).toHaveURL(/\/performance\/periods\/.+\/dashboard/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // OKR dashboard shows objectives or empty state
    await expect(
      page.getByText(/objetivos|no hay objetivos|okr|nuevo objetivo/i).first()
    ).toBeVisible()
  } else {
    // No periods in seed — verify empty state renders correctly
    await expect(page.getByText(/no hay periodos/i)).toBeVisible()
  }
})

test('26 — ver lista de KPIs con información del indicador', async ({ page }) => {
  await page.goto('/performance/kpis')

  // KPIListPage uses DataTable (a real table)
  await expect(page.getByRole('heading', { name: /kpi|indicadores/i })).toBeVisible()

  // Check if KPIs exist in the table
  const hasData = await page.getByRole('columnheader', { name: /indicador/i })
    .isVisible({ timeout: 3_000 }).catch(() => false)

  if (hasData) {
    await expect(page.getByRole('columnheader', { name: /indicador/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /meta/i })).toBeVisible()

    // Navigate to first KPI dashboard via "Dashboard" button in actions column
    const dashBtn = page.getByRole('button', { name: /dashboard/i }).first()
    const hasKpi = await dashBtn.isVisible({ timeout: 2_000 }).catch(() => false)

    if (hasKpi) {
      await dashBtn.click()
      await expect(page).toHaveURL(/\/performance\/kpis\/.+\/dashboard/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  } else {
    await expect(page.getByText(/no hay kpi|no hay indicadores|no hay/i)).toBeVisible()
  }
})
