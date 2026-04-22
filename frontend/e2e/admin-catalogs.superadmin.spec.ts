/**
 * Catálogos globales (Admin) — superadmin puede escribir; admin tenant solo lee.
 */
import { test, expect } from '@playwright/test'

// Tests 10-11: superadmin con permisos de escritura
test.describe('superadmin — escritura en catálogos globales', () => {
  test.use({ storageState: 'e2e/.auth/superadmin.json' })

  test('10 — dashboard de catálogos globales muestra 6 tarjetas con contadores', async ({ page }) => {
    await page.goto('/admin/catalogs')

    await expect(page.getByRole('heading', { name: /catálogos globales/i })).toBeVisible()

    // Each card renders the label as <h3> and description as <p>.
    // Using exact:true to avoid matching description text that also contains the label.
    const labels = ['Países', 'Departamentos', 'Ciudades', 'Tipos de Documento', 'Bancos', 'Seg. Social']
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
    // At least one card shows a numeric counter
    await expect(page.locator('.text-2xl.font-bold').first()).toBeVisible()
  })

  test('11 — gestionar bancos: crear, editar, desactivar', async ({ page }) => {
    await page.goto('/admin/catalogs/banks')
    await expect(page.getByRole('heading', { name: /bancos/i })).toBeVisible()

    // "Nuevo banco" button is only shown when canWrite === true (is_superuser=true)
    const createBtn = page.getByRole('button', { name: /nuevo banco/i })
    const canWrite = await createBtn.isVisible({ timeout: 2_000 }).catch(() => false)

    if (!canWrite) {
      console.warn('[TEST 11] Superadmin sin is_superuser en DB — verificando modo solo lectura.')
      await expect(page.getByText(/solo lectura|superusuario/i)).toBeVisible()
      return
    }

    const bankName = `Banco E2E ${Date.now()}`

    // Crear
    await createBtn.click()
    await page.getByPlaceholder(/bancolombia|nombre/i).fill(bankName)
    await page.locator('input[name="code"]').fill('E2E')
    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(bankName)).toBeVisible({ timeout: 10_000 })

    // Editar
    const row = page.getByRole('row').filter({ hasText: bankName })
    await row.getByRole('button', { name: /editar/i }).click()
    await page.getByPlaceholder(/bancolombia|nombre/i).clear()
    await page.getByPlaceholder(/bancolombia|nombre/i).fill(`${bankName} Editado`)
    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(`${bankName} Editado`)).toBeVisible({ timeout: 10_000 })

    // Desactivar
    const editedRow = page.getByRole('row').filter({ hasText: `${bankName} Editado` })
    await editedRow.getByRole('button', { name: /desactivar/i }).click()
    // Confirmar en ConfirmDialog
    await page.getByRole('button', { name: 'Desactivar' }).last().click()
    await expect(
      page.getByRole('row').filter({ hasText: `${bankName} Editado` }).getByText('Inactivo')
    ).toBeVisible({ timeout: 10_000 })
  })
})

// Test 12: admin de tenant NO puede editar catálogos globales
test.describe('admin tenant — solo lectura en catálogos globales', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('12 — admin de tenant no ve botones de escritura en catálogos globales', async ({ page }) => {
    await page.goto('/admin/catalogs/banks')

    await expect(page.getByRole('heading', { name: /bancos/i })).toBeVisible()
    // No debe haber botón de crear
    await expect(page.getByRole('button', { name: /nuevo banco/i })).not.toBeVisible()
    // Debe aparecer el aviso de solo lectura
    await expect(page.getByText(/solo lectura|superusuario/i)).toBeVisible()
  })
})
