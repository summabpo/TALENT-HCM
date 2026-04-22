# Talent HCM

## Overview

Talent is an HCM platform at `talent.nomiweb.co` that complements Nomiweb (payroll) and an existing ATS. Multi-tenant SaaS (2–5 pilot clients), prepared for i18n.

**Extended project runbook (architecture, status, local setup, API/Vite notes):** `project_context.md` in the repo root. **Cursor short entry that links to it:** `hcmcursor.md`.

## Tech Stack

- **Backend:** Python 3.12+, Django 5.x, Django REST Framework
- **Frontend:** React 18+ (Vite), TypeScript, Tailwind CSS
- **Database:** PostgreSQL 16+ on AWS RDS (NOT Docker)
- **Cache/Sessions:** Redis 7+ (shared with Nomiweb for auth)
- **Task Queue:** Celery + Redis
- **API Docs:** drf-spectacular (OpenAPI 3.0)
- **Deployment:** Docker containers on EC2, Nginx Proxy Manager for SSL/routing

## Architecture Decisions

- **Multi-tenancy:** Shared DB, `tenant_id` column on every table. All models inherit `TenantModel`.
- **Auth:** Nomiweb owns login (sessions). Talent reads shared sessions from Redis via `SESSION_COOKIE_DOMAIN=.nomiweb.co`. No User model in Talent — uses `SharedSessionUser` from session data.
- **DB strategy:** ORM for CRUD, raw SQL for complex reports only.
- **Catalogs:** Global catalogs (cities, EPS, AFP, banks, etc.) have no tenant. Tenant-scoped catalogs (positions, cost centers, work locations) have `tenant_id`. All aligned with Nomiweb's existing tables for future API sync.
- **Employee/Contract models** mirror Nomiweb's `contratosemp` and `contratos` field structure for seamless future integration.

## Modules — Phase 1

1. **Core** (`apps/core`) — Tenant, base models, middleware, auth, permissions
2. **Catalogs** (`apps/catalogs`) — Global + tenant-scoped reference data
3. **Hiring & Onboarding** (`apps/hiring`) — Hiring processes, candidates, onboarding checklists
4. **Personnel** (`apps/personnel`) — Employees, contracts, documents, departments, history
5. **Quality ISO 9001** (`apps/quality`) — Processes, documents, audits, nonconformities, CAPA
6. **KPIs & OKRs** (`apps/performance`) — Objectives, key results, KPI tracking

## Modules — Phase 2

- Evaluaciones de Desempeño (`apps/evaluations`)
- Portal del Empleado (`apps/portal`)
- Encuestas de Clima Laboral (`apps/surveys`)
- Organigrama Interactivo (`apps/orgchart`)

## Project Structure

```
talent/
├── CLAUDE.md                  ← this file
├── docs/                      ← detailed specs (read on demand)
│   ├── models.md              ← all Django models
│   ├── deployment.md          ← Docker, compose, NPM, RDS
│   └── api-endpoints.md       ← all API routes
├── manage.py
├── requirements/
├── config/
│   ├── settings/ (base, dev, prod)
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── core/
│   ├── catalogs/
│   ├── hiring/
│   ├── personnel/
│   ├── quality/
│   └── performance/
├── locale/ (es, en)
├── frontend/                  ← React SPA
│   ├── src/
│   │   ├── api/
│   │   ├── components/ (common, layout, catalogs, hiring, personnel, quality, performance)
│   │   ├── pages/
│   │   ├── contexts/ (auth, tenant)
│   │   ├── hooks/
│   │   ├── i18n/
│   │   └── types/
│   ├── vite.config.ts
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```

## Implementation Order

1. **Sprint 1–2:** Scaffolding, core module, catalogs, auth, Docker setup
2. **Sprint 3–4:** Personnel (employees, contracts, departments, documents)
3. **Sprint 5–6:** Hiring & Onboarding
4. **Sprint 7–9:** Quality (ISO 9001)
5. **Sprint 9–10:** KPIs & OKRs
6. **Sprint 11:** Polish, i18n, deploy, UAT

## Key Rules

- Every model inherits `TimestampedTenantModel` (except global catalogs).
- Every queryset must filter by `tenant`.
- UUIDs as primary keys everywhere (`id = models.UUIDField`).
- `global_employee_id` links Employee across systems (Talent, Nomiweb, ATS).
- API versioned at `/api/v1/`.
- All user-facing strings use `gettext_lazy` for i18n.

## Detailed Specs

For full model definitions, Docker configs, and API endpoints, read the files in `docs/`:
- `docs/models-core.md` — Multi-tenancy base, auth setup, and all catalog models (global + tenant-scoped)
- `docs/models-modules.md` — Hiring, Personnel, Quality, and Performance module models with field mappings to Nomiweb
- `docs/deployment.md` — Dockerfiles, docker-compose, NPM config, RDS setup, env vars
- `docs/api-endpoints.md` — All API routes per module and DB schema summary
