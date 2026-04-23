# Talent HCM — entrada para Cursor

**Documento maestro (contexto, arquitectura, entorno, APIs, Vite, recordatorios):** [`project_context.md`](project_context.md)

**Reglas y convenciones del repositorio (agente / desarrollo):** [`CLAUDE.md`](CLAUDE.md)

---

No duplicar hechos de dominio, stack o setup aquí: actualizar **`project_context.md`**.  
Este archivo solo sirve para abrir un chat con contexto fijo y, si quieres, **notas breves de la sesión** (abajo).

## Notas de sesión (opcional, volátil)

- **Rama activa (último estado):** `feature/contratFields` (sale de `develop`). Cambios Nomiweb empleado/contrato: modelo/serializer/UI + migración `personnel.0003_add_remaining_nomiweb_fields` — si el listado de empleados falla, ejecutar `migrate` en la misma DB que usa el API.
- **Venv local habitual:** `/Users/guidoangulo/GitKrakenRepos/entornos/hcm` → `python manage.py …`
- **GitKraken:** abrir repo raíz `…/organization/talent-hcm` (no la carpeta anidada `TALENT-HCM/` ni el padre `organization` solo).
- **Remoto:** `origin` → https://github.com/summabpo/TALENT-HCM.git
- Pendiente en esa rama (si no se commiteó aún): revisar `git status`, commit + `git push -u origin feature/contratFields` y PR hacia `develop`.

---

*Última alineación: un solo cuerpo de verdad en `project_context.md`, enlazado desde aquí y desde la sección DOCUMENTATION MAP de ese archivo.*
