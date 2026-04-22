/**
 * Catálogos tenant — Cargos y Centros de costo.
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('catálogo de cargos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/catalogs/positions')
    await expect(page.getByRole('heading', { name: /cargos/i })).toBeVisible()
  })

  test('27 — listar cargos del seed', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /cargo|nombre/i }).first()).toBeVisible()
  })

  test('27b — crear cargo nuevo', async ({ page }) => {
    const positionName = `Cargo E2E ${Date.now()}`

    await page.getByRole('button', { name: /nuevo cargo/i }).click()
    // El formulario inline se abre
    await page.getByPlaceholder(/analista|nombre/i).fill(positionName)

    // Seleccionar nivel si el select está disponible y tiene opciones
    const levelSelect = page.locator('select[name="level"]')
    const levelCount = await levelSelect.locator('option').count()
    if (levelCount > 1) {
      await levelSelect.selectOption({ index: 1 })
    }

    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(positionName)).toBeVisible({ timeout: 10_000 })
  })

  test('27c — editar cargo existente', async ({ page }) => {
    // Solo si hay al menos una fila de datos
    const firstRow = page.getByRole('row').nth(1)
    const hasRows = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!hasRows) {
      test.skip(true, 'No hay cargos en el seed para editar')
    }

    await firstRow.getByRole('button', { name: /editar/i }).click()

    const input = page.getByPlaceholder(/analista|nombre/i)
    const current = await input.inputValue()
    await input.fill(`${current} Editado`)
    await page.getByRole('button', { name: /guardar/i }).click()

    await expect(page.getByText(`${current} Editado`)).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('centros de costo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/catalogs/cost-centers')
    await expect(page.getByRole('heading', { name: /centros de costo/i })).toBeVisible()
  })

  test('28 — ver centros de costo', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /nombre/i })).toBeVisible()
  })

  test('28b — crear centro de costo y verificar en sub-centros', async ({ page }) => {
    const ccName = `CC E2E ${Date.now()}`

    await page.getByRole('button', { name: /nuevo centro/i }).click()
    await page.getByPlaceholder(/administración|nombre/i).fill(ccName)

    // Sufijo opcional
    const suffixInput = page.locator('input[name="suffix"]')
    if (await suffixInput.isVisible()) {
      await suffixInput.fill('E2')
    }

    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(ccName)).toBeVisible({ timeout: 10_000 })

    // Verificar que aparece en el selector de sub-centros de costo
    await page.goto('/settings/catalogs/sub-cost-centers')
    await expect(page.getByRole('heading', { name: /sub-centros/i })).toBeVisible()

    await page.getByRole('button', { name: /nuevo sub/i }).click()

    const parentSelect = page.locator('select[name="cost_center"]')
    await expect(parentSelect.locator(`option:has-text("${ccName}")`)).toHaveCount(1)
  })
})
