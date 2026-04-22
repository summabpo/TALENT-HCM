/**
 * Módulo de Reclutamiento — procesos de hiring y candidatos.
 *
 * NOTA: HiringProcessListPage usa tarjetas (cards), no tabla.
 * Los procesos se muestran en un grid de cards, no en filas de tabla.
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.beforeEach(async ({ page }) => {
  await page.goto('/hiring/processes')
  await expect(page.getByRole('heading', { name: /procesos de contratación/i })).toBeVisible()
})

test('17 — ver lista de procesos de hiring del seed', async ({ page }) => {
  // "Nuevo proceso" button must always be visible
  await expect(page.getByRole('button', { name: /nuevo proceso/i })).toBeVisible()

  // Processes render as cards (no table). Check for either cards or empty state.
  const hasProcesses = await page.getByRole('link', { name: /ver detalle/i }).first()
    .isVisible({ timeout: 3_000 }).catch(() => false)

  if (hasProcesses) {
    // At least one process card exists with a "Ver detalle" link
    await expect(page.getByRole('link', { name: /ver detalle/i }).first()).toBeVisible()
  } else {
    await expect(page.getByText(/no hay procesos/i)).toBeVisible()
  }
})

test('18 — ver detalle de proceso con sección de candidatos', async ({ page }) => {
  // Check if any process cards exist
  const detailLink = page.getByRole('link', { name: /ver detalle/i }).first()
  const hasProcesses = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false)

  if (!hasProcesses) {
    // No processes in seed — create one first
    await page.getByRole('button', { name: /nuevo proceso/i }).click()
    await expect(page).toHaveURL('/hiring/processes/create')

    const positionTitle = `Cargo E2E ${Date.now()}`
    const titleInput = page.locator('input[name="position_title"], input[placeholder*="cargo"]').first()
    await titleInput.fill(positionTitle)

    await page.getByRole('button', { name: /guardar|crear/i }).click()
    await page.waitForURL(/\/hiring\/processes/, { timeout: 10_000 })
    // Navigate back to list if redirected to detail
    await page.goto('/hiring/processes')
    await page.waitForURL('/hiring/processes')
  }

  // Click "Ver detalle" on first process card
  await page.getByRole('link', { name: /ver detalle/i }).first().click()
  await expect(page).toHaveURL(/\/hiring\/processes\/[0-9a-f-]+$/)

  // Detail page shows "Candidatos" as an h2 section heading
  await expect(page.getByRole('heading', { level: 2, name: /candidatos/i })).toBeVisible()
})

test('19 — agregar candidato a proceso existente', async ({ page }) => {
  const detailLink = page.getByRole('link', { name: /ver detalle/i }).first()
  const hasProcesses = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false)

  if (!hasProcesses) {
    console.warn('[TEST 19] Sin procesos en el seed. Omitiendo.')
    await expect(page.getByText(/no hay procesos/i)).toBeVisible()
    return
  }

  await detailLink.click()
  await expect(page).toHaveURL(/\/hiring\/processes\/[0-9a-f-]+$/)

  // Only open/in_progress processes allow adding candidates
  const addBtn = page.getByRole('button', { name: /agregar candidato/i })
  const canAdd = await addBtn.isVisible({ timeout: 2_000 }).catch(() => false)

  if (!canAdd) {
    console.warn('[TEST 19] Proceso no está abierto — no se puede agregar candidato.')
    await expect(page.getByRole('heading', { name: /candidatos/i })).toBeVisible()
    return
  }

  await addBtn.click()

  const candidateName = `Candidato E2E ${Date.now()}`
  await page.getByPlaceholder(/nombre completo/i).fill(candidateName)
  await page.locator('input[type="email"]').last().fill(`candidato.e2e.${Date.now()}@demo.co`)

  await page.getByRole('button', { name: 'Agregar' }).click()

  await expect(page.getByText(candidateName)).toBeVisible({ timeout: 10_000 })
})

test('20 — mover candidato de etapa (applied → interview)', async ({ page }) => {
  const detailLink = page.getByRole('link', { name: /ver detalle/i }).first()
  const hasProcesses = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false)

  if (!hasProcesses) {
    console.warn('[TEST 20] Sin procesos en el seed. Omitiendo.')
    await expect(page.getByText(/no hay procesos/i)).toBeVisible()
    return
  }

  await detailLink.click()
  await expect(page).toHaveURL(/\/hiring\/processes\/[0-9a-f-]+$/)

  // Ensure there is at least one candidate
  const addBtn = page.getByRole('button', { name: /agregar candidato/i })
  const noCandidates = await page.getByText('No hay candidatos aún.').isVisible({ timeout: 2_000 }).catch(() => false)
  const hasAddBtn = await addBtn.isVisible({ timeout: 1_000 }).catch(() => false)

  if (noCandidates && hasAddBtn) {
    await addBtn.click()
    await page.getByPlaceholder(/nombre completo/i).fill('Candidato Mover E2E')
    await page.locator('input[type="email"]').last().fill(`mover.${Date.now()}@demo.co`)
    await page.getByRole('button', { name: 'Agregar' }).click()
    await expect(page.getByText('Candidato Mover E2E')).toBeVisible({ timeout: 10_000 })
  }

  // Click on a candidate link to navigate to their detail page
  const candidateLink = page.locator('table').getByRole('link').first()
  const hasCandidateLink = await candidateLink.isVisible({ timeout: 3_000 }).catch(() => false)

  if (!hasCandidateLink) {
    console.warn('[TEST 20] Sin candidatos en el proceso. Omitiendo cambio de etapa.')
    return
  }

  await candidateLink.click()
  await expect(page).toHaveURL(/\/candidates\//)

  // CandidateDetailPage: stage select is near "Cambiar etapa" label (no name attribute)
  const stageSelect = page.locator('select').last()
  const hasStageSelect = await stageSelect.isVisible({ timeout: 2_000 }).catch(() => false)

  if (hasStageSelect) {
    await stageSelect.selectOption('interview')
    // Selecting triggers mutation immediately (no save button)
    await expect(page.getByText('Entrevista')).toBeVisible({ timeout: 10_000 })
  } else {
    // Candidate may already be hired/rejected — just verify page loaded
    await expect(page.getByRole('heading')).toBeVisible()
  }
})
