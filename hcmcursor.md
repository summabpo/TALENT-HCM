# Talent HCM — entrada para Cursor

**Documento maestro (contexto, arquitectura, entorno, APIs, Vite, recordatorios):** [`project_context.md`](project_context.md)

**Reglas y convenciones del repositorio (agente / desarrollo):** [`CLAUDE.md`](CLAUDE.md)

---

No duplicar hechos de dominio, stack o setup aquí: actualizar **`project_context.md`**.  
Este archivo solo sirve para abrir un chat con contexto fijo y, si quieres, **notas breves de la sesión** (abajo).

**Backend — campos y API de Tenant (admin / staff, CRUD de empresas):** el contrato y los campos viven en [`apps/core/tenant_serializers.py`](apps/core/tenant_serializers.py) (`TenantAdminSerializer`) y el modelo en [`apps/core/models.py`](apps/core/models.py) (`Tenant`). **No** confundir con [`apps/core/serializers.py`](apps/core/serializers.py) (autenticación, login, resúmenes, `TenantSummarySerializer`, etc.).

## Notas de sesión (opcional, volátil)

- **Rama activa (último estado):** `feature/security-audit` (incluye `develop` con **contract fields** ya fusionados: empleado/contrato Nomiweb, `resume_file`, bloqueo DELETE empleados, etc.). Migraciones `personnel.0003_*` y `0004_employee_resume_file` — `migrate` en la misma DB que usa el API.
- **`develop`:** recibe vía fast-forward el trabajo que estaba en `feature/contratFields` (pushed a `origin/develop`).
- **Venv local habitual:** `/Users/guidoangulo/GitKrakenRepos/entornos/hcm` → `python manage.py …`
- **GitKraken:** abrir repo raíz `…/organization/talent-hcm` (no la carpeta anidada `TALENT-HCM/` ni el padre `organization` solo).
- **Remoto:** `origin` → https://github.com/summabpo/TALENT-HCM.git

### Handoff — última sesión (E2E superadmin / tenants)

- **Hecho:** Corregidos fallos en **`frontend/e2e/admin-tenants.superadmin.spec.ts`** (solo tests, sin lógica de app). Tests **6–9** + setup pasan con Playwright (`npx playwright test e2e/admin-tenants.superadmin.spec.ts --project=chromium`).
- **Test 7 (crear empresa):** `TenantFormPage` exige NIT, representante, email, teléfono, dirección, país y ciudad. En E2E: opciones de **react-select** deben acotarse a **`.summa-select__menu`** (un `getByRole('option')` global pega el `<select>` nativo de tipo de documento). Catálogo puede tener países duplicados (COLOMBIA / Colombia) → `.first()` tras filtrar. Ciudad: elegir **primera opción** del menú (regex `/Bogotá/i` falla si el DOM usa `Bogota` sin tilde). Redirect: `toHaveURL('/admin/tenants', { timeout: 30_000 })`.
- **Tests 8–9:** Strict mode por varias filas con “Demo Company” → fila con **`.first()`** antes de **Editar** / **Módulos**.
- **Referencias útiles:** `frontend/src/pages/admin/TenantFormPage.tsx`, `frontend/src/components/ui/SelectSearchable.tsx`, backend **`apps/core/tenant_serializers.py`** (no `serializers.py`), `apps/core/tenant_views.py`, auth E2E superadmin en `frontend/e2e/auth.setup.ts` / `e2e/helpers/auth.ts` (credenciales documentadas en conversación previa).
- **Siguiente chat:** Si algo vuelve a fallar en E2E, revisar stack Playwright en `frontend/test-results/…` y que API (`127.0.0.1:8001`) + Vite (`5173`) estén arriba; ampliar detalle en **`project_context.md`** si cambia el dominio o el seed.

---

*Última alineación: un solo cuerpo de verdad en `project_context.md`, enlazado desde aquí y desde la sección DOCUMENTATION MAP de ese archivo.*
