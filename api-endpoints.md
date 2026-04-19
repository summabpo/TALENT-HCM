# Talent HCM — API Endpoints & Database Schema

All API routes per module and database schema summary.
Referenced by CLAUDE.md.

---

## 10. Database Schema Summary

```
db_talent (PostgreSQL)
│
├── core_tenant
│
├── catalog_country               ← global (no tenant)
├── catalog_state_province        ← global
├── catalog_city                  ← global
├── catalog_document_type         ← global
├── catalog_social_security_entity ← global (EPS, AFP, ARL, CCF, Cesantías)
├── catalog_bank                  ← global
├── catalog_contract_type         ← global
├── catalog_salary_type           ← global
├── catalog_contributor_type      ← global
├── catalog_contributor_subtype   ← global
├── catalog_diagnosis             ← global
├── catalog_absence_type          ← global
├── catalog_holiday               ← global
├── catalog_profession            ← global
├── catalog_contract_template     ← global
├── catalog_organizational_level  ← per tenant
├── catalog_position              ← per tenant (cargos)
├── catalog_cost_center           ← per tenant (costos)
├── catalog_sub_cost_center       ← per tenant (subcostos)
├── catalog_work_location         ← per tenant (sedes)
├── catalog_work_center           ← per tenant (centros de trabajo)
│
├── hiring_process
├── hiring_candidate
├── hiring_onboarding_checklist
├── hiring_onboarding_task
├── hiring_employee_onboarding
├── hiring_task_completion
│
├── personnel_department
├── personnel_employee          ← central entity, has global_employee_id
├── personnel_contract          ← mirrors Nomiweb contratos structure
├── personnel_document
├── personnel_history
│
├── quality_process
├── quality_document
├── quality_audit
├── quality_audit_finding
├── quality_nonconformity
├── quality_improvement
│
├── performance_okr_period
├── performance_objective
├── performance_key_result
├── performance_kr_update
├── performance_kpi             ← can link to quality_process
├── performance_kpi_measurement
```

All tables have `tenant_id` column (FK to `core_tenant`). All queries must filter by tenant.

### Key Indexes

```sql
-- Performance-critical indexes beyond Django defaults
CREATE INDEX idx_employee_tenant_status ON personnel_employee(tenant_id, status);
CREATE INDEX idx_employee_tenant_doc ON personnel_employee(tenant_id, document_number);
CREATE INDEX idx_employee_global_id ON personnel_employee(global_employee_id);
CREATE INDEX idx_contract_employee_current ON personnel_contract(employee_id, is_current);
CREATE INDEX idx_nonconformity_tenant_status ON quality_nonconformity(tenant_id, status);
CREATE INDEX idx_audit_tenant_status ON quality_audit(tenant_id, status);
CREATE INDEX idx_candidate_process_status ON hiring_candidate(hiring_process_id, status);
```

---


---

## 14. Implementation Priority

### Sprint 1–2: Foundation
- [ ] Project scaffolding (Django + React + Docker)
- [ ] Core module: Tenant model, middleware, base models, managers
- [ ] Auth: Redis shared sessions, SharedSessionAuthentication
- [ ] Catalogs module: all global models + tenant-scoped models
- [ ] Seed catalogs: cities, departments (CO), document types, SS entities, banks, contract types, contributor types, diagnoses, holidays
- [ ] Catalogs API: read-only endpoints for global, CRUD for tenant-scoped
- [ ] React: auth context, protected routes, layout shell
- [ ] Docker: docker-compose.yml + docker-compose.dev.yml
- [ ] NPM: Proxy Host for talent.nomiweb.co
- [ ] CI/CD pipeline, dev/prod settings

### Sprint 3–4: Personnel
- [ ] Department CRUD with hierarchy (parent)
- [ ] Employee CRUD with full profile (aligned with Nomiweb contratosemp)
- [ ] Contract management with all SS, tax and banking fields (aligned with Nomiweb contratos)
- [ ] Document upload & management with expiration tracking
- [ ] Employee history / audit trail
- [ ] Frontend: employee list, detail, forms with dynamic selects from catalogs API

### Sprint 5–6: Hiring & Onboarding
- [ ] Hiring process & candidate management
- [ ] Candidate stage transitions
- [ ] Hire action → auto-create Employee + Contract
- [ ] Onboarding checklists (templates)
- [ ] Onboarding tracking & completion
- [ ] Frontend: hiring pipeline, onboarding dashboard

### Sprint 7–9: Quality (ISO 9001)
- [ ] Process map & controlled documents
- [ ] Internal audit planning & execution
- [ ] Findings & nonconformity tracking with CAPA
- [ ] Continuous improvement register
- [ ] Quality dashboard
- [ ] Frontend: all quality views

### Sprint 9–10: KPIs & OKRs
- [ ] OKR periods, objectives (company/department/individual)
- [ ] Key Results with targets and progress updates
- [ ] Standalone KPIs with measurement tracking
- [ ] Link KPIs to Quality processes (ISO 9001 metrics)
- [ ] Dashboard: OKR tree, KPI trends, department progress
- [ ] Frontend: OKR editor, KPI charts, check-in forms

### Sprint 11: Polish & Deploy
- [ ] i18n: complete Spanish translations
- [ ] Comprehensive API tests
- [ ] Production deployment via Docker on AWS
- [ ] Performance tuning (indexes, query optimization)
- [ ] User acceptance testing with pilot clients
- [ ] Seed catalog data from Nomiweb DB exports for pilot tenants


---

## API Endpoints by Module


### 7.0 Catálogos & Datos Maestros (`apps/catalogs`)


```
GET    /api/v1/catalogs/countries/
GET    /api/v1/catalogs/states/
GET    /api/v1/catalogs/cities/
GET    /api/v1/catalogs/cities/?state={id}
GET    /api/v1/catalogs/document-types/
GET    /api/v1/catalogs/social-security-entities/
GET    /api/v1/catalogs/social-security-entities/?type=EPS
GET    /api/v1/catalogs/banks/
GET    /api/v1/catalogs/contract-types/
GET    /api/v1/catalogs/salary-types/
GET    /api/v1/catalogs/contributor-types/
GET    /api/v1/catalogs/diagnoses/
GET    /api/v1/catalogs/absence-types/
GET    /api/v1/catalogs/holidays/?year=2026
GET    /api/v1/catalogs/professions/
GET    /api/v1/catalogs/contract-templates/

# Tenant-scoped (CRUD)
GET|POST          /api/v1/catalogs/positions/
GET|PATCH|DELETE  /api/v1/catalogs/positions/{id}/
GET|POST          /api/v1/catalogs/cost-centers/
GET|POST          /api/v1/catalogs/sub-cost-centers/
GET|POST          /api/v1/catalogs/work-locations/
GET|POST          /api/v1/catalogs/work-centers/
GET|POST          /api/v1/catalogs/organizational-levels/
```



### 7.1 Contratación & Onboarding (`apps/hiring`)


```
POST   /api/v1/hiring/processes/
GET    /api/v1/hiring/processes/
GET    /api/v1/hiring/processes/{id}/
PATCH  /api/v1/hiring/processes/{id}/
POST   /api/v1/hiring/processes/{id}/candidates/
PATCH  /api/v1/hiring/candidates/{id}/
POST   /api/v1/hiring/candidates/{id}/hire/         # transitions to hired, creates Employee
GET    /api/v1/hiring/onboarding-checklists/
POST   /api/v1/hiring/onboarding-checklists/
GET    /api/v1/hiring/onboardings/                   # active onboardings
PATCH  /api/v1/hiring/onboardings/{id}/tasks/{task_id}/complete/
```



### 7.2 Administración de Personal (`apps/personnel`)


```
GET    /api/v1/personnel/employees/
POST   /api/v1/personnel/employees/
GET    /api/v1/personnel/employees/{id}/
PATCH  /api/v1/personnel/employees/{id}/
GET    /api/v1/personnel/employees/{id}/contracts/
POST   /api/v1/personnel/employees/{id}/contracts/
GET    /api/v1/personnel/employees/{id}/documents/
POST   /api/v1/personnel/employees/{id}/documents/
GET    /api/v1/personnel/employees/{id}/history/
GET    /api/v1/personnel/departments/
POST   /api/v1/personnel/departments/
GET    /api/v1/personnel/departments/{id}/org-tree/
```



### 7.3 Sistema de Calidad ISO 9001 (`apps/quality`)


```
GET    /api/v1/quality/processes/
POST   /api/v1/quality/processes/
GET    /api/v1/quality/documents/
POST   /api/v1/quality/documents/
GET    /api/v1/quality/audits/
POST   /api/v1/quality/audits/
POST   /api/v1/quality/audits/{id}/findings/
GET    /api/v1/quality/nonconformities/
POST   /api/v1/quality/nonconformities/
PATCH  /api/v1/quality/nonconformities/{id}/
GET    /api/v1/quality/improvements/
POST   /api/v1/quality/improvements/
GET    /api/v1/quality/dashboard/
```



### 7.4 KPIs & OKRs (`apps/performance`)


```
GET    /api/v1/performance/periods/
POST   /api/v1/performance/periods/
GET    /api/v1/performance/objectives/
POST   /api/v1/performance/objectives/
GET    /api/v1/performance/objectives/{id}/
PATCH  /api/v1/performance/objectives/{id}/
GET    /api/v1/performance/objectives/{id}/key-results/
POST   /api/v1/performance/objectives/{id}/key-results/
POST   /api/v1/performance/key-results/{id}/updates/
GET    /api/v1/performance/kpis/
POST   /api/v1/performance/kpis/
POST   /api/v1/performance/kpis/{id}/measurements/
GET    /api/v1/performance/dashboard/
```


