# Talent HCM — entrada para Cursor

**Documento maestro (contexto, arquitectura, entorno, APIs, Vite, recordatorios):** [`project_context.md`](project_context.md)

**Reglas y convenciones del repositorio (agente / desarrollo):** [`CLAUDE.md`](CLAUDE.md)

---

No duplicar hechos de dominio, stack o setup aquí: actualizar **`project_context.md`**.  
Este archivo solo sirve para abrir un chat con contexto fijo y, si quieres, **notas breves de la sesión** (abajo).

## Notas de sesión (opcional, volátil)

- **Rama activa (último estado):** `feature/security-audit` (incluye `develop` con **contract fields** ya fusionados: empleado/contrato Nomiweb, `resume_file`, bloqueo DELETE empleados, etc.). Migraciones `personnel.0003_*` y `0004_employee_resume_file` — `migrate` en la misma DB que usa el API.
- **`develop`:** recibe vía fast-forward el trabajo que estaba en `feature/contratFields` (pushed a `origin/develop`).
- **Venv local habitual:** `/Users/guidoangulo/GitKrakenRepos/entornos/hcm` → `python manage.py …`
- **GitKraken:** abrir repo raíz `…/organization/talent-hcm` (no la carpeta anidada `TALENT-HCM/` ni el padre `organization` solo).
- **Remoto:** `origin` → https://github.com/summabpo/TALENT-HCM.git

---

*Última alineación: un solo cuerpo de verdad en `project_context.md`, enlazado desde aquí y desde la sección DOCUMENTATION MAP de ese archivo.*
