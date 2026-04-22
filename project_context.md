════════════════════════════════════════════════════════════════════════════════
TALENT HCM - PROJECT ARCHITECTURE & STATUS SUMMARY
════════════════════════════════════════════════════════════════════════════════

PROJECT: Talent HCM - Human Capital Management Platform
Client: SUMMA BPO (Colombian HR services)
Integration: Complements Nomiweb (payroll) at nomiweb.co

DOCUMENTATION MAP (read these in this order; do not fork duplicate facts)
  - This file: single source of truth for architecture, status, local setup, APIs/Vite/DB gotchas
  - hcmcursor.md: Cursor entry point (links here + CLAUDE.md + optional session notes)
  - CLAUDE.md: Agent/project rules and conventions for the repo

════════════════════════════════════════════════════════════════════════════════
TECH STACK
════════════════════════════════════════════════════════════════════════════════

Backend:
  - Python 3.12+ / Django 5.x / Django REST Framework
  - PostgreSQL 16 on AWS RDS (NOT Docker)
  - Redis 7+ (shared with Nomiweb for sessions)
  - Celery + Redis for async tasks
  - drf-spectacular (OpenAPI 3.0)

Frontend:
  - React 18+ / Vite / TypeScript / Tailwind CSS
  - React Query (TanStack) for data fetching
  - React Hook Form for forms
  - Recharts for data visualization
  - SUMMA BPO brand colors: Navy #212f87, Magenta #d52680, Cyan #7dc7e9

Deployment:
  - Docker containers on EC2
  - Nginx Proxy Manager for SSL/routing
  - RDS for PostgreSQL

════════════════════════════════════════════════════════════════════════════════
ARCHITECTURE DECISIONS
════════════════════════════════════════════════════════════════════════════════

Multi-tenancy:
  - Shared database, shared schema
  - tenant_id column on every table
  - All models inherit TimestampedTenantModel
  - Every queryset filters by tenant
  - UUIDs as primary keys

Authentication:
  - JWT tokens (independent, NOT Nomiweb-dependent)
  - User model created in Phase 2
  - Role model (admin, manager, employee, recruiter, quality_auditor)
  - UserTenant junction: user ↔ tenant with M2M roles
  - TenantModules: each tenant configures enabled modules
  - Shared Redis sessions only for Nomiweb backward compatibility (future)

API:
  - Versioned at /api/v1/
  - HasTenant + HasModule permissions on all endpoints
  - Nested routers for relationships
  - DRF pagination: `TalentPageNumberPagination` honors `?page_size=` (cap) so list endpoints
    are not hard-limited to 50 rows when the client requests more (e.g. cities for a country).
  - 106+ tests (approx.; run full suite when changing shared code)

Catalogs:
  - Global catalogs: Countries, Cities, Banks, EPS/AFP/ARL, DocumentTypes, etc.
  - Tenant-scoped: Positions, CostCenters, WorkLocations, WorkCenters
  - Align with Nomiweb tables for future API sync
  - Seeded via seed_catalogs management command

════════════════════════════════════════════════════════════════════════════════
MODULES IMPLEMENTED (PHASE 1-2)
════════════════════════════════════════════════════════════════════════════════

✅ CORE (apps/core)
  - Auth (JWT, User, Role, UserTenant, TenantModules)
  - Permissions (HasTenant, HasModule, HasRole)
  - Middleware (TenantMiddleware, TenantSerializer)
  - API: POST /auth/login/, POST /auth/logout/, GET /auth/me/

✅ CATALOGS (apps/catalogs)
  - Global: Country, StateProvince, City, DocumentType, SocialSecurityEntity, Bank, etc.
  - Tenant-scoped: Position, CostCenter, SubCostCenter, WorkLocation, WorkCenter, OrganizationalLevel
  - API: GET /catalogs/* (20+ endpoints)

✅ PERSONNEL (apps/personnel)
  - Models: Employee, Contract, Department, EmployeeDocument, EmployeeHistory
  - Employee mirrors Nomiweb contratosemp (4-part name, cities, SS entities, global_employee_id)
  - Contract mirrors Nomiweb contratos (salary, SS FKs, bank, taxes, contributor types)
  - API: 8 tests passing, CRUD endpoints

✅ HIRING (apps/hiring)
  - Models: HiringProcess, Candidate, OnboardingChecklist, OnboardingTask, EmployeeOnboarding, OnboardingTaskCompletion
  - Candidate stages: applied → interview → offer → hired → rejected
  - Hire action: creates Employee + Contract + starts onboarding
  - API: 21 tests passing, includes hire action

✅ QUALITY (apps/quality) - ISO 9001
  - Models: QualityProcess, QualityDocument, InternalAudit, AuditFinding, NonConformity (CAPA), ContinuousImprovement
  - Document approval workflow
  - Nonconformity closure workflow
  - API: 26 tests passing, dashboard with charts

✅ PERFORMANCE (apps/performance) - OKRs + KPIs
  - Models: OKRPeriod, Objective, KeyResult, KeyResultUpdate, KPI, KPIMeasurement
  - Objectives cascade (company → department → individual)
  - Progress auto-calculated from KeyResults
  - API: 20+ tests passing, tree visualization

════════════════════════════════════════════════════════════════════════════════
FRONTEND SCREENS (EXTENDED: BASE MODULE SCREENS + ADMIN + SETTINGS)
════════════════════════════════════════════════════════════════════════════════

PERSONNEL (5):
  - EmployeeListPage (/personnel/employees)
  - EmployeeDetailPage (/personnel/employees/{id})
  - EmployeeFormPage (/personnel/employees/create, /edit)
  - ContractDetailPage (/personnel/employees/{id}/contracts/{contract_id})
  - OnboardingPage (/personnel/employees/{id}/onboarding)

HIRING (4 routes incl. form):
  - HiringProcessListPage, HiringProcessFormPage, HiringProcessDetailPage, CandidateDetailPage

QUALITY (5):
  - QualityDashboardPage (/quality/dashboard) - pie/bar charts
  - QualityProcessListPage, QualityProcessDetailPage
  - NonconformityListPage, NonconformityDetailPage

PERFORMANCE (4):
  - OKRPeriodListPage, OKRDashboardPage, KPIListPage, KPIDashboardPage

Shared: DashboardPage, LoginPage, Sidebar, Header, TenantContext/AuthContext

ADMIN — tenants (staff):
  - TenantListPage (/admin/tenants)
  - TenantFormPage (/admin/tenants/create, /edit) — company fields, NIT, logo/signature, country→city
  - TenantModulesPage (/admin/tenants/{id}/modules)

ADMIN — global catalogs (staff/superuser per route guard in app):
  - AdminCatalogsIndexPage, AdminCountryPage, AdminStatePage, AdminCityPage,
    AdminDocumentTypePage, AdminBankPage, AdminSocialSecurityPage
  - Under /admin/catalogs/...

SETTINGS — tenant-scoped catalogs:
  - OrganizationalLevel, Position, CostCenter, SubCostCenter, WorkLocation, WorkCenter
  - Under /settings/catalogs/...

STYLING:
  - SUMMA BPO brand applied: Navy headers, Magenta buttons, Cyan accents
  - Tailwind CSS with custom color palette
  - Components: Card, Button (primary/secondary/danger), DataTable, ProgressBar, Badge, ConfirmDialog
  - Animations: fade-in, smooth transitions

════════════════════════════════════════════════════════════════════════════════
PROJECT STATUS
════════════════════════════════════════════════════════════════════════════════

PHASE 1 (COMPLETE):
  ✅ Core scaffolding
  ✅ Auth system (JWT + multi-tenant)
  ✅ Catalogs (global + tenant-scoped)
  ✅ Personnel (Employees, Contracts, Departments)
  ✅ Hiring (HiringProcess, Candidates, Onboarding)
  ✅ Quality (ISO 9001: Processes, Documents, Audits, Nonconformities)
  ✅ Performance (OKRs, KeyResults, KPIs)
  ✅ Frontend (core module screens + admin tenants/catalogs + settings catalogs + SUMMA branding)
  ✅ Testing (backend suite; re-run on changes)
  ✅ Admin: tenant CRUD + global catalog UIs; API pagination for large catalog lists

PHASE 2 (FUTURE):
  - Evaluaciones de Desempeño (360° reviews)
  - Portal del Empleado (employee self-service)
  - Encuestas de Clima Laboral (climate surveys)
  - Organigrama Interactivo (org chart)

════════════════════════════════════════════════════════════════════════════════
CURRENT WORK (IN PROGRESS) — see also “NOTES FOR NEXT CHAT” at bottom
════════════════════════════════════════════════════════════════════════════════

1. EXPAND SEED DATA:
   - Status: IN PROGRESS
   - Task: Populate catalogs; generate demo employee/contract/hiring/quality/performance data
   - Where: apps/core/management/commands/seed_catalogs.py, seed_dev.py

2. TENANT MANAGEMENT (TenantFormPage):
   - Status: MOSTLY IMPLEMENTED (create/edit, modules, many company fields, uploads, country→city)
   - **Ciudad (city) UX (2026-04):** One React Query per selected country
     `['catalog', 'cities', countryId]` — `tenantsApi.getCities` uses `page_size=5000`. Filter while
     typing is **client-side** (SelectSearchable prefix), **not** a second `?search=` request on
     each keystroke. **Do not** reintroduce debounced server search that toggles `queryKey` at
     2+ chars while `isDisabled={loading}`: it disabled the control mid-type, lost focus, and
     “jumped” the page. If server search is ever needed for huge countries, use
     `placeholderData: keepPreviousData` and **never** disable the select while refetching.

3. DOCUMENTATION / E2E / security / AWS: unchanged roadmap (see “NEXT STEPS” below)

════════════════════════════════════════════════════════════════════════════════
DIRECTORY STRUCTURE
════════════════════════════════════════════════════════════════════════════════

talent-hcm/
├── manage.py
├── requirements/
│   └── base.txt (Django, DRF, simplejwt, psycopg2, redis, celery, etc.)
├── config/
│   ├── settings/ (base.py, dev.py, prod.py, test.py)
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── core/ (Auth, Tenant, Permissions, BaseModels)
│   ├── catalogs/ (Global + Tenant-scoped catalogs)
│   ├── personnel/ (Employee, Contract, Department)
│   ├── hiring/ (HiringProcess, Candidate, Onboarding)
│   ├── quality/ (QualityProcess, Audit, Nonconformity)
│   └── performance/ (OKRs, KPIs)
├── locale/ (es, en translations)
├── frontend/
│   ├── src/
│   │   ├── api/ (client.ts, personnel, hiring, quality, performance, tenants, catalogs, …)
│   │   ├── components/ (ui/ common layout, dashboard, forms)
│   │   ├── pages/ (personnel/, hiring/, quality/, performance/, admin/)
│   │   ├── contexts/ (AuthContext, TenantContext)
│   │   ├── hooks/ (useAuth, useTenant, custom hooks)
│   │   ├── types/ (User, Tenant, Employee, Contract, etc.)
│   │   ├── i18n/ (es.json, en.json)
│   │   ├── App.tsx (routing, protected routes)
│   │   └── index.css (SUMMA brand colors + global styles)
│   ├── tailwind.config.js (SUMMA colors: summaNavy, summaMagenta, summaCyan, etc.)
│   ├── vite.config.ts
│   └── package.json
├── Dockerfile (Django + Node build stages)
├── docker-compose.yml (prod: backend, frontend, celery, redis)
├── docker-compose.dev.yml (dev: postgres, redis)
├── .env.example
├── .env.local (dev environment)
└── .env (prod environment - on EC2, not committed)

════════════════════════════════════════════════════════════════════════════════
KEY FILES TO KNOW
════════════════════════════════════════════════════════════════════════════════

Backend Models:
  - apps/core/models.py (Tenant, User, Role, UserTenant, TenantModules)
  - apps/catalogs/models.py (Country, City, DocumentType, etc. - 21 models)
  - apps/personnel/models.py (Employee, Contract, Department)
  - apps/hiring/models.py (HiringProcess, Candidate, Onboarding)
  - apps/quality/models.py (QualityProcess, Audit, NonConformity, etc.)
  - apps/performance/models.py (OKRPeriod, Objective, KeyResult, KPI)

Backend Auth:
  - apps/core/authentication.py (TalentJWTAuthentication)
  - apps/core/permissions.py (HasTenant, HasModule, HasRole)
  - apps/core/views.py (LoginView, RegisterView, MeView)

Frontend Components:
  - src/components/layout/Sidebar.tsx (module navigation, admin menu)
  - src/components/layout/Header.tsx (user info, tenant selector)
  - src/components/ui/ (Button, Card, DataTable, ProgressBar, Badge, etc.)
  - src/pages/admin/TenantFormPage.tsx (tenant create/edit; city list: one query per country, client filter)
  - src/components/ui/SelectSearchable.tsx (react-select wrapper; `clientFilter` prefix/none)
  - src/contexts/AuthContext.tsx (JWT + user state)

Seed Data:
  - apps/core/management/commands/seed_catalogs.py (populate global catalogs)
  - apps/core/management/commands/seed_dev.py (create demo data)

════════════════════════════════════════════════════════════════════════════════
LOCAL DEVELOPMENT SETUP
════════════════════════════════════════════════════════════════════════════════

venv location: /Users/guidoangulo/GitKrakenRepos/entornos/hcm
Project location: ~/GitKrakenRepos/organization/talent-hcm (this repo)

Commands:
  # Backend
  source /Users/guidoangulo/GitKrakenRepos/entornos/hcm/bin/activate
  source .env.local
  python manage.py runserver 0.0.0.0:8001

  # Frontend
  cd frontend
  npm run dev  # http://localhost:5173

  # Docker (Postgres + Redis)
  docker compose -f docker-compose.dev.yml up -d postgres-dev redis
  docker compose -f docker-compose.dev.yml ps

  # Seed data
  python manage.py seed_catalogs
  python manage.py seed_dev

  # Tests
  pytest apps/personnel/tests/ -v
  pytest apps/hiring/tests/ -v
  pytest apps/quality/tests/ -v

POSTGRES (local, docker-compose.dev.yml) — do not skip this
  - Container Postgres maps host localhost:5433 -> container 5432. Another Postgres on
    :5432 is often a different instance; use 5433 for this project if you use compose.
  - .env.local should set e.g. TALENT_DB_HOST=localhost, TALENT_DB_PORT=5433 on the host.
  - manage.py loads .env.local then .env from repo root (python-dotenv) so runserver
    and migrate use the same DB as GUI clients; without it, base.py defaults may use 5432.
  - .env.dev inside Docker uses TALENT_DB_HOST=postgres-dev (for containers, not host runserver).
  - If something looks “empty” in the API, confirm you are on the right port/schema first.

DAILY API / FRONTEND (single reference, was previously split in hcmcursor)
  - API base: /api/v1/ ; Django root often redirects to Swagger at /api/docs/
  - GET /api/v1/auth/me/ -> { user (is_staff, is_superuser), tenant, modules }
  - Tenants (SPA admin, not only Django /admin/):
      GET/POST /api/v1/tenants/
      GET/PATCH/DELETE /api/v1/tenants/{id}/
      GET/PATCH /api/v1/tenants/{id}/modules/
    Requires is_staff (JWT). Create/delete tenant: is_superuser only. Staff without
    superuser: membership via core_user_tenant; list may be scoped to JWT tenant.
  - Catalogs: /api/v1/catalogs/... (paginated { count, results }; `page_size` respected up to cap).
    Cities: GET .../cities/?country=<id> — frontend `getCities` passes `page_size=5000` for tenant form.
  - Tenant model (company) extra fields: see apps/core/migrations/0003_tenant_company_fields.py
  - TenantModules includes evaluations flag; /auth/me/ exposes via serializer.

VITE (frontend)
  - Proxy /api to runserver (port e.g. 8000/8001). Proxy /media to same for tenant files.
  - Do not proxy /admin — React Router owns SPA routes under /admin/tenants.
  - In api/client.ts: if body is FormData, omit Content-Type so multipart boundary is set.
  - After changing vite.config.ts, restart npm run dev.

REACT ROUTER — static segments before :id
  (avoid "create" / "edit" being parsed as UUID)
  - Hiring: /hiring/processes/create, /hiring/processes/:id/edit, then /hiring/processes/:id
  - Contracts: /personnel/employees/:id/contracts/create, .../:contractId/edit, then .../:contractId
  - Hiring process states (backend): open | in_progress | filled | cancelled (not draft/closed in model)
  - Contracts need seeded catalogs (contract type, position, work center, EPS, CCF, contributor type, …)

DB TABLES (useful for debugging auth/tenant)
  - core_tenant: tenant row + company fields (migr. 0003)
  - core_tenant_modules: per-tenant feature flags
  - core_user: email, is_staff, is_superuser
  - core_user_tenant: user_id, tenant_id, is_active, roles

QUICK REMINDERS
  - Django /admin/ is not the same as SPA /admin/tenants (companies).
  - is_superuser: create/delete tenant via API. Client admin: staff + membership, often not superuser.
  - Hiring process = vacancy; employee in Personnel is a separate create/hire flow.
  - New contract: catalogs must exist; seed_catalogs/tenant positions as needed.

════════════════════════════════════════════════════════════════════════════════
NEXT STEPS (AFTER THIS CHAT)
════════════════════════════════════════════════════════════════════════════════

PRIORITY ORDER:

1. SEED DATA (IN PROGRESS)
   - Expand seed_catalogs (e.g. Colombian geographic data) and seed_dev (employees, contracts, etc.)
   - Verify forms have enough selectable values end-to-end

2. TENANT / ADMIN POLISH (as needed)
   - Any missing validations, copy, or superuser-only flows; avoid regressing city field pattern above

3. DOCUMENTATION
   - README.md (overview, tech stack, local setup)
   - DEPLOYMENT.md (AWS RDS + EC2 setup step-by-step)
   - API.md (all endpoints, examples)
   - USER_GUIDE.md (how to use the platform)
   - ADMIN_GUIDE.md (tenant/module management)

4. E2E TESTING
   - Cypress or Playwright tests
   - 20+ test cases covering happy path + edge cases
   - Multi-tenant isolation verification

5. SECURITY AUDIT
   - JWT expiration + refresh logic
   - CORS settings
   - File upload validation
   - Rate limiting on auth endpoints

6. AWS DEPLOYMENT (Final)
   - Create RDS PostgreSQL instance
   - Create EC2 Ubuntu 24 instance
   - Configure .env on EC2 with RDS credentials
   - Setup SSL with Let's Encrypt
   - Deploy Docker containers
   - Run migrations against RDS
   - Seed production data

════════════════════════════════════════════════════════════════════════════════
IMPORTANT LINKS & CREDENTIALS
════════════════════════════════════════════════════════════════════════════════

Local URLs:
  Frontend: http://localhost:5173
  Backend: http://localhost:8001
  Admin: http://localhost:8001/admin/
  API Schema: http://localhost:8001/api/schema/

Test Credentials:
  Email: admin@demo.co
  Password: admin1234
  Tenant: Demo Company

Default Admin Tenant Modules (all enabled):
  ✅ hiring ✅ personnel ✅ quality ✅ performance

GitHub:
  https://github.com/summabpo/nomiweb (source of model mappings)

════════════════════════════════════════════════════════════════════════════════
NOTES FOR NEXT CHAT
════════════════════════════════════════════════════════════════════════════════

- hcmcursor.md + CLAUDE.md + this file: read order for agents
- **TenantForm city field:** one query per country, client prefix filter; do not block Select while
  refetching a search query (prevents 2nd-letter focus loss / page jump)
- DRF: list endpoints use configurable `page_size` (not stuck at 50) — relevant for cities, etc.
- Phase 2 roadmap: Evaluaciones, Portal empleado, clima, organigrama (unchanged)
- Re-run `pytest` + `cd frontend && npm run build` after non-trivial backend/TS changes
- Production readiness: still tied to seed data depth + docs + hardening, not a single “green build” line