# Talent HCM — Architecture & Implementation Guide

## 1. Vision

Talent is a Human Capital Management (HCM) platform built to complement Nomiweb (payroll) and an existing ATS. Inspired by Paychex's evolution from payroll to full HCM, Talent adds hiring, onboarding, personnel administration, quality management, performance, and employee self-service capabilities.

- **URL:** `talent.nomiweb.co`
- **Auth:** Shared sessions via Redis with Nomiweb (`nomiweb.co`)
- **Target:** Multi-tenant SaaS, 2–5 pilot clients initially
- **Internationalization:** Prepared for i18n from day one

---

## 2. Platform Ecosystem

```
┌──────────────┐                          ┌──────────────────────────────┐
│     ATS      │   candidato_contratado   │         Talent HCM          │
│   db_ats     │ ───────────────────────→ │         db_talent            │
└──────────────┘         (future)         │                              │
                                          │  Contratación & Onboarding   │
                                          │  Administración de Personal  │
                                          │  Sistema de Calidad ISO 9001 │
                                          │  Evaluaciones & KPIs (v2)    │
                                          │  Portal del Empleado (v2)    │
                                          │  Encuestas de Clima (v2)     │
                                          │  Organigrama (v2)            │
                                          └──────────────┬───────────────┘
                                                         │
                                              resumen_novedades_período
                                                     (future)
                                          ┌──────────────▼───────────────┐
                                          │          Nomiweb             │
                                          │  db_payroll (schema public)  │
                                          │  db_payroll (schema pila)    │
                                          │                              │
                                          │  Nómina & Liquidación        │
                                          │  Novedades (vacaciones, etc.) │
                                          │  Archivo plano PILA          │
                                          └──────────────────────────────┘
```

### Integration Strategy

- **Phase 1 (now):** Talent is standalone. No integrations with Nomiweb or ATS.
- **Phase 2 (future):** Connect Talent → Nomiweb via REST API to push attendance summaries, payroll novelties. Connect ATS → Talent to flow hired candidates into onboarding.
- **Shared auth:** From Phase 1, sessions are shared via Redis (same domain, cookie-based).

---

## 3. Tech Stack

| Layer         | Technology                                      |
|---------------|------------------------------------------------|
| Backend       | Python 3.12+, Django 5.x, Django REST Framework |
| Frontend      | React 18+ (Vite), TypeScript, Tailwind CSS      |
| Database      | PostgreSQL 16+                                   |
| Cache/Session | Redis 7+                                         |
| Task Queue    | Celery + Redis broker                            |
| File Storage  | Django Storages (S3-compatible or local)         |
| API Docs      | drf-spectacular (OpenAPI 3.0)                    |
| Testing       | pytest, pytest-django, factory_boy              |
| Deployment    | Same server as Nomiweb (Nginx + Gunicorn)       |

### Database Access Strategy: Hybrid (ORM + Raw SQL)

Use Django ORM for all standard CRUD operations. The ORM handles migrations, validations, multi-tenant filtering, and keeps code maintainable. Use raw SQL only for:

- Complex analytical reports and aggregations
- Performance-critical bulk operations
- Queries that are awkward or inefficient in ORM (multi-join reports, window functions)

```python
# ORM for standard operations
employees = Employee.objects.filter(tenant=request.tenant, is_active=True)

# Raw SQL for complex reports
from django.db import connection
def attendance_summary_report(tenant_id, period_start, period_end):
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT e.id, e.full_name,
                   SUM(a.worked_hours) as total_hours,
                   SUM(CASE WHEN a.is_overtime THEN a.worked_hours ELSE 0 END) as overtime
            FROM personnel_employee e
            JOIN attendance_record a ON a.employee_id = e.id
            WHERE e.tenant_id = %s
              AND a.date BETWEEN %s AND %s
            GROUP BY e.id, e.full_name
        """, [tenant_id, period_start, period_end])
        return dictfetchall(cursor)
```

---

## 4. Multi-Tenancy

Strategy: **shared database, shared schema, tenant_id column on every table.**

### Base Model

Every model in Talent inherits from `TenantModel`:

```python
# apps/core/models.py
import uuid
from django.db import models

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)  # used in URLs or subdomains if needed
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_tenant'

class TenantModel(models.Model):
    """Abstract base for all tenant-scoped models."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, db_index=True)

    class Meta:
        abstract = True

class TimestampedTenantModel(TenantModel):
    """Adds created_at and updated_at to TenantModel."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

### Tenant Middleware

```python
# apps/core/middleware.py
from apps.core.models import Tenant

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            tenant_id = request.session.get('tenant_id')
            if tenant_id:
                try:
                    request.tenant = Tenant.objects.get(id=tenant_id, is_active=True)
                except Tenant.DoesNotExist:
                    request.tenant = None
            else:
                request.tenant = None
        else:
            request.tenant = None
        return self.get_response(request)
```

### Tenant-Scoped QuerySet

```python
# apps/core/managers.py
from django.db import models

class TenantManager(models.Manager):
    def for_tenant(self, tenant):
        return self.get_queryset().filter(tenant=tenant)

# Usage in views:
employees = Employee.objects.for_tenant(request.tenant).filter(is_active=True)
```

### Tenant-Aware Serializer

```python
# apps/core/serializers.py
from rest_framework import serializers

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        fields = '__all__'
        read_only_fields = ['tenant']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super().create(validated_data)
```

---

## 5. Authentication (Shared Sessions via Redis)

Talent does NOT have its own User model. Nomiweb owns auth. Talent reads the shared Redis session.

### Redis Config (both apps, identical)

```python
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'sessions'
SESSION_COOKIE_NAME = 'nomiweb_session'
SESSION_COOKIE_DOMAIN = '.nomiweb.co'
SESSION_COOKIE_AGE = 28800  # 8 hours

CACHES = {
    'sessions': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://localhost:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}
```

### Nomiweb Login (add session data)

```python
# In Nomiweb's login view, after django.contrib.auth.login():
request.session['user_email'] = user.email
request.session['user_full_name'] = user.get_full_name()
request.session['user_roles'] = list(user.groups.values_list('name', flat=True))
request.session['tenant_id'] = str(user.profile.tenant_id)
```

### Talent Session Auth

```python
# apps/core/authentication.py
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

class SharedSessionUser:
    def __init__(self, session_data):
        self.id = session_data.get('_auth_user_id')
        self.email = session_data.get('user_email', '')
        self.full_name = session_data.get('user_full_name', '')
        self.roles = session_data.get('user_roles', [])
        self.tenant_id = session_data.get('tenant_id')
        self.is_authenticated = True
        self.is_anonymous = False

    def has_role(self, role):
        return role in self.roles

class SharedSessionAuthentication(BaseAuthentication):
    def authenticate(self, request):
        user_id = request.session.get('_auth_user_id')
        if not user_id:
            return None
        user = SharedSessionUser(request.session)
        return (user, None)
```

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.core.authentication.SharedSessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

### Unauthenticated Redirect

```python
# apps/core/middleware.py
class LoginRedirectMiddleware:
    """For API calls returns 401. For browser navigation redirects to Nomiweb login."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if response.status_code == 401 and not request.path.startswith('/api/'):
            return redirect(f'https://nomiweb.co/login/?next={request.build_absolute_uri()}')
        return response
```

---

## 6. Internationalization (i18n)

```python
# settings.py
USE_I18N = True
USE_L10N = True
LANGUAGE_CODE = 'es-co'
LANGUAGES = [
    ('es', 'Español'),
    ('en', 'English'),
]
LOCALE_PATHS = [BASE_DIR / 'locale']
```

All user-facing strings in models use gettext:

```python
from django.utils.translation import gettext_lazy as _

class Employee(TimestampedTenantModel):
    class Meta:
        verbose_name = _('employee')
        verbose_name_plural = _('employees')

    full_name = models.CharField(_('full name'), max_length=255)
```

Frontend: use `react-i18next` with JSON locale files.

---

## 7. Modules — Phase 1 (Short Term, 0–6 months)

### 7.0 Catálogos & Datos Maestros (`apps/catalogs`)

Shared reference data aligned with Nomiweb's existing catalog tables. Catalogs are divided into two categories:

- **Global catalogs** (shared across all tenants): Countries, cities/departments, document types, social security entities (EPS, AFP, ARL, CCF, Cesantías), banks, diagnoses, holidays, contributor types. These mirror Nomiweb's global tables.
- **Tenant-scoped catalogs**: Positions (cargos), cost centers (costos/subcostos), work locations (sedes), work centers (centros de trabajo), organizational levels.

#### Models

```python
# apps/catalogs/models.py
import uuid
from django.db import models
from apps.core.models import TimestampedTenantModel

# ============================================================
# GLOBAL CATALOGS (no tenant — shared across all companies)
# These tables mirror Nomiweb's structure for future API sync
# ============================================================

class Country(models.Model):
    """Mirrors Nomiweb: paises"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    iso_code = models.CharField(max_length=3, blank=True)  # ISO 3166-1 alpha-2/3

    class Meta:
        db_table = 'catalog_country'
        verbose_name_plural = 'countries'

    def __str__(self):
        return self.name


class StateProvince(models.Model):
    """Colombian departments / states / provinces.
    Mirrors Nomiweb: derived from ciudades.coddepartamento + departamento"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=10)
    country = models.ForeignKey(Country, on_delete=models.PROTECT)

    class Meta:
        db_table = 'catalog_state_province'

    def __str__(self):
        return self.name


class City(models.Model):
    """Mirrors Nomiweb: ciudades"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=10)         # codciudad
    state_province = models.ForeignKey(StateProvince, on_delete=models.PROTECT)

    class Meta:
        db_table = 'catalog_city'
        verbose_name_plural = 'cities'

    def __str__(self):
        return f'{self.name}, {self.state_province.name}'


class DocumentType(models.Model):
    """Mirrors Nomiweb: tipodocumento"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)          # documento
    code = models.CharField(max_length=4)            # codigo
    dian_code = models.SmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'catalog_document_type'

    def __str__(self):
        return f'{self.code} - {self.name}'


class SocialSecurityEntityType(models.TextChoices):
    EPS = 'EPS', 'EPS'
    AFP = 'AFP', 'Fondo de Pensiones'
    ARL = 'ARL', 'ARL'
    CCF = 'CCF', 'Caja de Compensación'
    CESANTIAS = 'CESANTIAS', 'Fondo de Cesantías'


class SocialSecurityEntity(models.Model):
    """Mirrors Nomiweb: entidadessegsocial"""
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=9)            # codigo
    nit = models.CharField(max_length=12)
    name = models.CharField(max_length=120)          # entidad
    entity_type = models.CharField(               # tipoentidad
        max_length=20,
        choices=SocialSecurityEntityType.choices
    )
    sgp_code = models.CharField(max_length=10, blank=True)  # codsgp

    class Meta:
        db_table = 'catalog_social_security_entity'

    def __str__(self):
        return f'{self.entity_type} - {self.name}'


class Bank(models.Model):
    """Mirrors Nomiweb: bancos"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)          # nombanco
    code = models.CharField(max_length=10)           # codbanco
    ach_code = models.CharField(max_length=10, blank=True)  # codach
    nit = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = 'catalog_bank'

    def __str__(self):
        return self.name


class ContractType(models.Model):
    """Mirrors Nomiweb: tipocontrato"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)          # tipocontrato
    dian_code = models.SmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'catalog_contract_type'

    def __str__(self):
        return self.name


class SalaryType(models.Model):
    """Mirrors Nomiweb: tiposalario"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=40)           # tiposalario

    class Meta:
        db_table = 'catalog_salary_type'

    def __str__(self):
        return self.name


class ContributorType(models.Model):
    """Mirrors Nomiweb: tiposdecotizantes"""
    code = models.CharField(primary_key=True, max_length=2)  # tipocotizante
    description = models.CharField(max_length=120)
    form_code = models.SmallIntegerField(null=True, blank=True)  # codplanilla

    class Meta:
        db_table = 'catalog_contributor_type'

    def __str__(self):
        return f'{self.code} - {self.description}'


class ContributorSubtype(models.Model):
    """Mirrors Nomiweb: subtipocotizantes"""
    code = models.CharField(primary_key=True, max_length=2)
    description = models.CharField(max_length=100)
    form_code = models.SmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'catalog_contributor_subtype'

    def __str__(self):
        return f'{self.code} - {self.description}'


class Diagnosis(models.Model):
    """Mirrors Nomiweb: diagnosticosenfermedades (ICD-10 codes)"""
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=10)           # coddiagnostico
    name = models.CharField(max_length=255)          # diagnostico
    prefix = models.CharField(max_length=1)

    class Meta:
        db_table = 'catalog_diagnosis'
        verbose_name_plural = 'diagnoses'

    def __str__(self):
        return f'{self.code} - {self.name}'


class AbsenceType(models.Model):
    """Mirrors Nomiweb: ausencias"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)           # ausencia

    class Meta:
        db_table = 'catalog_absence_type'

    def __str__(self):
        return self.name


class Holiday(models.Model):
    """Mirrors Nomiweb: festivos"""
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    description = models.CharField(max_length=60, blank=True)
    year = models.SmallIntegerField()
    country = models.ForeignKey(Country, on_delete=models.PROTECT, default=1)  # default Colombia

    class Meta:
        db_table = 'catalog_holiday'

    def __str__(self):
        return f'{self.date} - {self.description}'


class Profession(models.Model):
    """Mirrors Nomiweb: profesiones"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=180)

    class Meta:
        db_table = 'catalog_profession'

    def __str__(self):
        return self.name


class ContractTemplate(models.Model):
    """Mirrors Nomiweb: modelos_contratos"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)          # nombremodelo
    contract_type = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)              # textocontrato
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_contract_template'

    def __str__(self):
        return self.name


# ============================================================
# TENANT-SCOPED CATALOGS (each company has its own)
# ============================================================

class OrganizationalLevel(TimestampedTenantModel):
    """Mirrors Nomiweb: nivelesestructura — but per tenant in Talent"""
    name = models.CharField(max_length=50)

    class Meta:
        db_table = 'catalog_organizational_level'

    def __str__(self):
        return self.name


class Position(TimestampedTenantModel):
    """Mirrors Nomiweb: cargos"""
    name = models.CharField(max_length=100)          # nombrecargo
    level = models.ForeignKey(OrganizationalLevel, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_position'

    def __str__(self):
        return self.name


class CostCenter(TimestampedTenantModel):
    """Mirrors Nomiweb: costos"""
    name = models.CharField(max_length=60)           # nomcosto
    accounting_group = models.CharField(max_length=4, blank=True)  # grupocontable
    suffix = models.CharField(max_length=2, blank=True)  # suficosto
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_cost_center'

    def __str__(self):
        return self.name


class SubCostCenter(TimestampedTenantModel):
    """Mirrors Nomiweb: subcostos"""
    name = models.CharField(max_length=60)           # nomsubcosto
    cost_center = models.ForeignKey(CostCenter, on_delete=models.CASCADE)
    suffix = models.CharField(max_length=2, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_sub_cost_center'

    def __str__(self):
        return f'{self.cost_center.name} > {self.name}'


class WorkLocation(TimestampedTenantModel):
    """Mirrors Nomiweb: sedes"""
    name = models.CharField(max_length=40)           # nombresede
    compensation_fund = models.ForeignKey(
        SocialSecurityEntity, on_delete=models.PROTECT,
        null=True, blank=True,
        limit_choices_to={'entity_type': 'CCF'}
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_work_location'

    def __str__(self):
        return self.name


class WorkCenter(TimestampedTenantModel):
    """Mirrors Nomiweb: centrotrabajo"""
    name = models.CharField(max_length=60)           # nombrecentrotrabajo
    arl_rate = models.DecimalField(max_digits=5, decimal_places=3)  # tarifaarl
    economic_activity = models.CharField(max_length=7, blank=True)
    operator_code = models.CharField(max_length=7, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_work_center'

    def __str__(self):
        return self.name
```

#### Data Migration Strategy

For Phase 1, global catalog data is seeded via fixtures or management commands. When the Nomiweb integration API is built (Phase 2), a sync mechanism will keep these in sync:

```python
# apps/catalogs/management/commands/seed_catalogs.py
# Imports data from CSV/JSON files that mirror Nomiweb's current catalog data
# Run: docker compose exec backend python manage.py seed_catalogs
```

For tenant-scoped catalogs (positions, cost centers, work locations, work centers), the data is entered manually per tenant in Phase 1, or bulk-imported from Nomiweb via CSV export.

#### API Endpoints

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

---

### 7.1 Contratación & Onboarding (`apps/hiring`)

Manages the process from candidate selection to active employee.

#### Models

```python
# apps/hiring/models.py
from apps.core.models import TimestampedTenantModel

class HiringProcess(TimestampedTenantModel):
    """A hiring process for a specific position."""
    position_title = models.CharField(max_length=255)
    department = models.ForeignKey('personnel.Department', on_delete=models.PROTECT, null=True)
    requested_by = models.CharField(max_length=255)
    status = models.CharField(max_length=30, choices=[
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('filled', 'Filled'),
        ('cancelled', 'Cancelled'),
    ], default='open')
    positions_count = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hiring_process'

class Candidate(TimestampedTenantModel):
    """A person being considered for hiring."""
    hiring_process = models.ForeignKey(HiringProcess, on_delete=models.CASCADE, related_name='candidates')
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    resume = models.FileField(upload_to='hiring/resumes/', blank=True)
    status = models.CharField(max_length=30, choices=[
        ('applied', 'Applied'),
        ('screening', 'Screening'),
        ('interview', 'Interview'),
        ('offer', 'Offer'),
        ('hired', 'Hired'),
        ('rejected', 'Rejected'),
    ], default='applied')

    class Meta:
        db_table = 'hiring_candidate'

class OnboardingChecklist(TimestampedTenantModel):
    """Template checklist for onboarding new hires."""
    name = models.CharField(max_length=255)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = 'hiring_onboarding_checklist'

class OnboardingTask(TimestampedTenantModel):
    """Individual task within a checklist."""
    checklist = models.ForeignKey(OnboardingChecklist, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    responsible_role = models.CharField(max_length=100, blank=True)  # who should complete it
    order = models.PositiveIntegerField(default=0)
    days_to_complete = models.PositiveIntegerField(default=7)

    class Meta:
        db_table = 'hiring_onboarding_task'
        ordering = ['order']

class EmployeeOnboarding(TimestampedTenantModel):
    """Tracks a specific employee's onboarding progress."""
    employee = models.OneToOneField('personnel.Employee', on_delete=models.CASCADE)
    checklist = models.ForeignKey(OnboardingChecklist, on_delete=models.PROTECT)
    start_date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ], default='in_progress')

    class Meta:
        db_table = 'hiring_employee_onboarding'

class OnboardingTaskCompletion(TimestampedTenantModel):
    """Tracks completion of individual onboarding tasks."""
    onboarding = models.ForeignKey(EmployeeOnboarding, on_delete=models.CASCADE, related_name='completions')
    task = models.ForeignKey(OnboardingTask, on_delete=models.CASCADE)
    completed_by = models.CharField(max_length=255, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hiring_task_completion'
        unique_together = ['onboarding', 'task']
```

#### Features

- Create hiring processes tied to positions/departments
- Track candidates through stages (applied → screening → interview → offer → hired)
- When candidate is marked "hired," auto-create Employee record in Personnel module
- Configurable onboarding checklists per department or position
- Track onboarding task completion with responsible parties
- Dashboard showing pending onboardings and progress

#### API Endpoints

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

---

### 7.2 Administración de Personal (`apps/personnel`)

Core employee records, organizational structure, contracts, and documents. Models aligned with Nomiweb's `contratosemp` and `contratos` tables for future API integration.

#### Models

```python
# apps/personnel/models.py
import uuid
from django.db import models
from apps.core.models import TimestampedTenantModel
from apps.catalogs.models import (
    Country, City, DocumentType, SocialSecurityEntity,
    Bank, ContractType, SalaryType, ContributorType,
    ContributorSubtype, Position, CostCenter, SubCostCenter,
    WorkLocation, WorkCenter, ContractTemplate, Profession,
)


class Department(TimestampedTenantModel):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    manager = models.ForeignKey('Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='managed_departments')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'personnel_department'


class Employee(TimestampedTenantModel):
    """Central employee record aligned with Nomiweb's contratosemp.
    Each domain (payroll, ATS) has its own view of the employee.
    They are linked by global_employee_id (UUID)."""
    global_employee_id = models.UUIDField(unique=True, default=uuid.uuid4)

    # Identity — mirrors contratosemp
    document_type = models.ForeignKey(DocumentType, on_delete=models.PROTECT)       # tipodocident
    document_number = models.BigIntegerField()                                       # docidentidad
    first_name = models.CharField(max_length=50)                                     # pnombre
    second_name = models.CharField(max_length=50, blank=True)                        # snombre
    first_last_name = models.CharField(max_length=50)                                # papellido
    second_last_name = models.CharField(max_length=50, blank=True)                   # sapellido

    # Contact
    email = models.EmailField(blank=True)
    personal_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=12, blank=True)                              # telefonoempleado
    cell_phone = models.CharField(max_length=12, blank=True)                         # celular
    address = models.CharField(max_length=100, blank=True)                           # direccionempleado

    # Personal data
    gender = models.CharField(max_length=10, blank=True)                             # sexo
    date_of_birth = models.DateField(null=True, blank=True)                          # fechanac
    birth_city = models.ForeignKey(City, on_delete=models.PROTECT, null=True,        # ciudadnacimiento
        related_name='employees_born')
    birth_country = models.ForeignKey(Country, on_delete=models.PROTECT, null=True,  # paisnacimiento
        related_name='employees_born')
    residence_city = models.ForeignKey(City, on_delete=models.PROTECT, null=True,    # ciudadresidencia
        related_name='employees_residing')
    residence_country = models.ForeignKey(Country, on_delete=models.PROTECT, null=True,
        related_name='employees_residing')
    marital_status = models.CharField(max_length=20, blank=True)                     # estadocivil
    blood_type = models.CharField(max_length=10, blank=True)                         # gruposanguineo
    socioeconomic_stratum = models.CharField(max_length=5, blank=True)               # estrato

    # Academic & professional
    profession = models.ForeignKey(Profession, on_delete=models.PROTECT, null=True, blank=True)
    education_level = models.CharField(max_length=25, blank=True)                    # niveleducativo

    # ID document details
    document_expedition_date = models.DateField(null=True, blank=True)               # fechaexpedicion
    document_expedition_city = models.ForeignKey(City, on_delete=models.PROTECT,     # ciudadexpedicion
        null=True, blank=True, related_name='employees_expedition')

    # Uniform sizes — mirrors contratosemp
    uniform_pants = models.CharField(max_length=10, blank=True)                      # dotpantalon
    uniform_shirt = models.CharField(max_length=10, blank=True)                      # dotcamisa
    uniform_shoes = models.CharField(max_length=10, blank=True)                      # dotzapatos

    # Emergency contact
    emergency_contact_name = models.CharField(max_length=150, blank=True)            # contact_name
    emergency_contact_phone = models.CharField(max_length=20, blank=True)            # contact_cell_phone
    emergency_contact_relationship = models.CharField(max_length=20, blank=True)     # contact_relationship

    # Photo
    photo = models.ImageField(upload_to='personnel/photos/', blank=True)

    # Organizational info (Talent-native, not in Nomiweb's contratosemp)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True)
    direct_manager = models.ForeignKey('self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='direct_reports')
    employee_number = models.CharField(max_length=30, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=[
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('on_leave', 'On Leave'),
        ('terminated', 'Terminated'),
    ], default='active')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'personnel_employee'
        indexes = [
            models.Index(fields=['tenant', 'document_number']),
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['global_employee_id']),
        ]

    @property
    def full_name(self):
        parts = [self.first_name, self.second_name, self.first_last_name, self.second_last_name]
        return ' '.join(p for p in parts if p)


class Contract(TimestampedTenantModel):
    """Mirrors Nomiweb's contratos table structure for future API sync."""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='contracts')

    # Contract basics
    contract_type = models.ForeignKey(ContractType, on_delete=models.PROTECT)        # tipocontrato
    contract_template = models.ForeignKey(ContractTemplate, on_delete=models.PROTECT,# idmodelo
        null=True, blank=True)
    start_date = models.DateField()                                                  # fechainiciocontrato
    end_date = models.DateField(null=True, blank=True)                               # fechafincontrato
    hiring_city = models.ForeignKey(City, on_delete=models.PROTECT, null=True)       # ciudadcontratacion

    # Compensation
    salary = models.DecimalField(max_digits=12, decimal_places=2)                    # salario
    salary_type = models.ForeignKey(SalaryType, on_delete=models.PROTECT, null=True) # tiposalario
    salary_mode = models.CharField(max_length=10, choices=[                          # salariovariable
        ('fixed', 'Fijo'),
        ('variable', 'Variable'),
        ('mixed', 'Mixto'),
    ], default='fixed')
    transport_allowance = models.BooleanField(default=False)                         # auxiliotransporte
    payment_method = models.CharField(max_length=25, blank=True)                     # formapago
    work_schedule = models.CharField(max_length=25, blank=True)                      # jornada

    # Banking
    bank = models.ForeignKey(Bank, on_delete=models.PROTECT, null=True, blank=True)  # bancocuenta
    bank_account_number = models.CharField(max_length=30, blank=True)                # cuentanomina
    bank_account_type = models.CharField(max_length=15, blank=True)                  # tipocuentanomina

    # Position & assignment
    position = models.ForeignKey(Position, on_delete=models.PROTECT)                 # cargo
    cost_center = models.ForeignKey(CostCenter, on_delete=models.PROTECT,            # idcosto
        null=True, blank=True)
    sub_cost_center = models.ForeignKey(SubCostCenter, on_delete=models.PROTECT,     # idsubcosto
        null=True, blank=True)
    work_location = models.ForeignKey(WorkLocation, on_delete=models.PROTECT,        # idsede
        null=True, blank=True)
    work_center = models.ForeignKey(WorkCenter, on_delete=models.PROTECT)            # centrotrabajo

    # Social security — references to catalog
    eps = models.ForeignKey(SocialSecurityEntity, on_delete=models.PROTECT,          # codeps
        related_name='contracts_eps',
        limit_choices_to={'entity_type': 'EPS'})
    afp = models.ForeignKey(SocialSecurityEntity, on_delete=models.PROTECT,          # codafp
        related_name='contracts_afp', null=True, blank=True,
        limit_choices_to={'entity_type': 'AFP'})
    ccf = models.ForeignKey(SocialSecurityEntity, on_delete=models.PROTECT,          # codccf
        related_name='contracts_ccf',
        limit_choices_to={'entity_type': 'CCF'})
    severance_fund = models.ForeignKey(SocialSecurityEntity, on_delete=models.PROTECT, # fondocesantias
        related_name='contracts_severance', null=True, blank=True,
        limit_choices_to={'entity_type': 'CESANTIAS'})

    # Contributor type (PILA)
    contributor_type = models.ForeignKey(ContributorType, on_delete=models.PROTECT)  # tipocotizante
    contributor_subtype = models.ForeignKey(ContributorSubtype,                      # subtipocotizante
        on_delete=models.PROTECT, null=True, blank=True)

    # Tax
    withholding_method = models.CharField(max_length=25, blank=True)                 # metodoretefuente
    withholding_percentage = models.DecimalField(max_digits=5, decimal_places=2,     # porcentajeretefuente
        null=True, blank=True)
    housing_deductible = models.IntegerField(null=True, blank=True)                  # valordeduciblevivienda
    health_deductible = models.IntegerField(null=True, blank=True)                   # saludretefuente
    medical_deductible = models.IntegerField(null=True, blank=True)                  # valordeduciblemedicina
    dependents = models.SmallIntegerField(null=True, blank=True)                     # dependientes

    # Status
    contract_status = models.SmallIntegerField(default=1)                            # estadocontrato (1=active, 2=terminated)
    settlement_status = models.CharField(max_length=25, blank=True)                  # estadoliquidacion
    social_security_status = models.CharField(max_length=25, blank=True)             # estadosegsocial
    is_pensioner = models.CharField(max_length=25, blank=True)                       # pensionado
    pension_risk = models.BooleanField(default=False)                                # riesgo_pension
    is_current = models.BooleanField(default=True)

    # Document
    document = models.FileField(upload_to='personnel/contracts/', blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'personnel_contract'
        ordering = ['-start_date']


class EmployeeDocument(TimestampedTenantModel):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=[
        ('id_copy', 'Copia Documento de Identidad'),
        ('rut', 'RUT'),
        ('bank_cert', 'Certificación Bancaria'),
        ('health_cert', 'Certificado de Salud'),
        ('education', 'Certificado de Educación'),
        ('background', 'Antecedentes'),
        ('resume', 'Hoja de Vida'),
        ('military_card', 'Libreta Militar'),
        ('other', 'Otro'),
    ])
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='personnel/documents/')
    expiration_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'personnel_document'


class EmployeeHistory(TimestampedTenantModel):
    """Audit trail — aligned with Nomiweb's history table structure."""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='history')
    change_type = models.CharField(max_length=30)  # promotion, transfer, salary_change, etc.
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    changed_by = models.CharField(max_length=255)
    reason = models.TextField(blank=True)

    class Meta:
        db_table = 'personnel_history'
        ordering = ['-created_at']
```

#### Field Mapping: Talent ↔ Nomiweb

When the integration API is built, these fields map directly:

| Talent Employee       | Nomiweb contratosemp     |
|-----------------------|--------------------------|
| document_type         | tipodocident             |
| document_number       | docidentidad             |
| first_name            | pnombre                  |
| second_name           | snombre                  |
| first_last_name       | papellido                |
| second_last_name      | sapellido                |
| birth_city            | ciudadnacimiento         |
| residence_city        | ciudadresidencia         |

| Talent Contract       | Nomiweb contratos        |
|-----------------------|--------------------------|
| contract_type         | tipocontrato             |
| position              | cargo                    |
| salary                | salario                  |
| eps                   | codeps                   |
| afp                   | codafp                   |
| ccf                   | codccf                   |
| work_center           | centrotrabajo            |
| cost_center           | idcosto                  |
| contributor_type      | tipocotizante            |

#### Features

- Full employee lifecycle management (hire → active → leave → terminate)
- Employee data aligned with Nomiweb (same fields, same catalogs) for seamless future sync
- Organizational structure (departments, positions, reporting hierarchy)
- Contract management with full social security, tax, and banking info
- Document management with expiration tracking
- Employee history / audit trail for all changes
- Headcount reports and organizational analytics

#### API Endpoints

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

---

### 7.3 Sistema de Calidad ISO 9001 (`apps/quality`)

Manages quality management system documentation, processes, audits, nonconformities, and continuous improvement per ISO 9001:2015.

#### Models

```python
# apps/quality/models.py
from apps.core.models import TimestampedTenantModel

class QualityProcess(TimestampedTenantModel):
    """A documented process within the QMS."""
    code = models.CharField(max_length=20)  # e.g., PR-RH-001
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT, null=True, related_name='owned_processes')
    department = models.ForeignKey('personnel.Department', on_delete=models.PROTECT, null=True)
    version = models.CharField(max_length=20, default='1.0')
    status = models.CharField(max_length=20, choices=[
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('under_review', 'Under Review'),
        ('obsolete', 'Obsolete'),
    ], default='draft')
    effective_date = models.DateField(null=True, blank=True)
    review_date = models.DateField(null=True, blank=True)  # next review

    class Meta:
        db_table = 'quality_process'

class QualityDocument(TimestampedTenantModel):
    """Controlled documents: procedures, work instructions, formats, records."""
    process = models.ForeignKey(QualityProcess, on_delete=models.CASCADE, related_name='documents', null=True, blank=True)
    code = models.CharField(max_length=30)
    title = models.CharField(max_length=255)
    document_type = models.CharField(max_length=30, choices=[
        ('procedure', 'Procedimiento'),
        ('instruction', 'Instrucción de Trabajo'),
        ('format', 'Formato'),
        ('record', 'Registro'),
        ('policy', 'Política'),
        ('manual', 'Manual'),
    ])
    version = models.CharField(max_length=20, default='1.0')
    file = models.FileField(upload_to='quality/documents/')
    status = models.CharField(max_length=20, choices=[
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('obsolete', 'Obsolete'),
    ], default='draft')
    approved_by = models.CharField(max_length=255, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    effective_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'quality_document'

class InternalAudit(TimestampedTenantModel):
    """Internal audit per ISO 9001 clause 9.2."""
    code = models.CharField(max_length=20)
    process = models.ForeignKey(QualityProcess, on_delete=models.PROTECT, related_name='audits')
    auditor = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT, related_name='audits_led')
    planned_date = models.DateField()
    executed_date = models.DateField(null=True, blank=True)
    scope = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[
        ('planned', 'Planned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ], default='planned')
    conclusions = models.TextField(blank=True)

    class Meta:
        db_table = 'quality_audit'

class AuditFinding(TimestampedTenantModel):
    """Finding from an internal audit."""
    audit = models.ForeignKey(InternalAudit, on_delete=models.CASCADE, related_name='findings')
    finding_type = models.CharField(max_length=30, choices=[
        ('nonconformity_major', 'No Conformidad Mayor'),
        ('nonconformity_minor', 'No Conformidad Menor'),
        ('observation', 'Observación'),
        ('opportunity', 'Oportunidad de Mejora'),
    ])
    clause = models.CharField(max_length=20, blank=True)  # ISO clause, e.g., "7.1.5"
    description = models.TextField()
    evidence = models.TextField(blank=True)

    class Meta:
        db_table = 'quality_audit_finding'

class NonConformity(TimestampedTenantModel):
    """Nonconformity and corrective/preventive action (CAPA)."""
    code = models.CharField(max_length=20)
    source = models.CharField(max_length=30, choices=[
        ('audit', 'Auditoría Interna'),
        ('external_audit', 'Auditoría Externa'),
        ('customer_complaint', 'Queja de Cliente'),
        ('process', 'Detección en Proceso'),
        ('employee', 'Reporte de Empleado'),
    ])
    audit_finding = models.ForeignKey(AuditFinding, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField()
    root_cause = models.TextField(blank=True)
    immediate_action = models.TextField(blank=True)
    corrective_action = models.TextField(blank=True)
    preventive_action = models.TextField(blank=True)
    responsible = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT, null=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('verification', 'Verification'),
        ('closed', 'Closed'),
    ], default='open')
    closed_at = models.DateTimeField(null=True, blank=True)
    effectiveness_verified = models.BooleanField(default=False)

    class Meta:
        db_table = 'quality_nonconformity'

class ContinuousImprovement(TimestampedTenantModel):
    """Improvement actions per ISO 9001 clause 10.3."""
    code = models.CharField(max_length=20)
    title = models.CharField(max_length=255)
    description = models.TextField()
    process = models.ForeignKey(QualityProcess, on_delete=models.PROTECT, null=True, blank=True)
    proposed_by = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT, related_name='improvements_proposed')
    responsible = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT, related_name='improvements_assigned')
    expected_benefit = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[
        ('proposed', 'Proposed'),
        ('approved', 'Approved'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ], default='proposed')
    priority = models.CharField(max_length=10, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ], default='medium')
    due_date = models.DateField(null=True, blank=True)
    result = models.TextField(blank=True)

    class Meta:
        db_table = 'quality_improvement'
```

#### Features

- Process map: model, organize, and version all QMS processes
- Controlled document management with approval workflow and version history
- Internal audit planning and execution with findings
- Nonconformity tracking with root cause analysis and CAPA (Corrective and Preventive Actions)
- Continuous improvement register
- Dashboards: open nonconformities, upcoming audits, document review dates, improvement status

#### API Endpoints

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

---

### 7.4 KPIs & OKRs (`apps/performance`)

Track organizational, team, and individual performance metrics.

#### Models

```python
# apps/performance/models.py
from apps.core.models import TimestampedTenantModel

class OKRPeriod(TimestampedTenantModel):
    """A time period for OKR/KPI evaluation (e.g., Q1 2026, H1 2026)."""
    name = models.CharField(max_length=100)           # e.g., "Q1 2026"
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = 'performance_okr_period'
        ordering = ['-start_date']

    def __str__(self):
        return self.name


class Objective(TimestampedTenantModel):
    """An Objective (the O in OKR). Can be company, department, or individual level."""
    LEVEL_CHOICES = [
        ('company', 'Company'),
        ('department', 'Department'),
        ('individual', 'Individual'),
    ]

    period = models.ForeignKey(OKRPeriod, on_delete=models.CASCADE, related_name='objectives')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    department = models.ForeignKey('personnel.Department', on_delete=models.PROTECT,
        null=True, blank=True)  # for department-level
    owner = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT,
        null=True, blank=True, related_name='owned_objectives')  # for individual-level
    parent = models.ForeignKey('self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='children')  # cascade alignment
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=100)  # % weight
    status = models.CharField(max_length=20, choices=[
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ], default='draft')

    class Meta:
        db_table = 'performance_objective'

    def __str__(self):
        return self.title


class KeyResult(TimestampedTenantModel):
    """A Key Result (the KR in OKR) — measurable outcome for an Objective."""
    objective = models.ForeignKey(Objective, on_delete=models.CASCADE, related_name='key_results')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    metric_type = models.CharField(max_length=20, choices=[
        ('number', 'Number'),
        ('percentage', 'Percentage'),
        ('currency', 'Currency'),
        ('boolean', 'Yes/No'),
    ], default='number')
    target_value = models.DecimalField(max_digits=12, decimal_places=2)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    start_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, blank=True)  # e.g., "deals", "%", "COP"
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=100)  # % weight within objective
    responsible = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT,
        null=True, blank=True)

    class Meta:
        db_table = 'performance_key_result'

    @property
    def progress_percentage(self):
        if self.target_value == self.start_value:
            return 100.0
        return float((self.current_value - self.start_value) / (self.target_value - self.start_value) * 100)


class KeyResultUpdate(TimestampedTenantModel):
    """A check-in / progress update on a Key Result."""
    key_result = models.ForeignKey(KeyResult, on_delete=models.CASCADE, related_name='updates')
    previous_value = models.DecimalField(max_digits=12, decimal_places=2)
    new_value = models.DecimalField(max_digits=12, decimal_places=2)
    comment = models.TextField(blank=True)
    updated_by = models.CharField(max_length=255)

    class Meta:
        db_table = 'performance_kr_update'
        ordering = ['-created_at']


class KPI(TimestampedTenantModel):
    """Standalone KPI — can exist independently or be linked to a Key Result or Quality Process."""
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    department = models.ForeignKey('personnel.Department', on_delete=models.PROTECT,
        null=True, blank=True)
    owner = models.ForeignKey('personnel.Employee', on_delete=models.PROTECT,
        null=True, blank=True)
    quality_process = models.ForeignKey('quality.QualityProcess', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='kpis')  # ISO 9001 integration
    metric_type = models.CharField(max_length=20, choices=[
        ('number', 'Number'),
        ('percentage', 'Percentage'),
        ('currency', 'Currency'),
    ], default='number')
    unit = models.CharField(max_length=20, blank=True)
    target_value = models.DecimalField(max_digits=12, decimal_places=2)
    frequency = models.CharField(max_length=20, choices=[
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
    ], default='monthly')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'performance_kpi'

    def __str__(self):
        return self.name


class KPIMeasurement(TimestampedTenantModel):
    """A single measurement/data point for a KPI."""
    kpi = models.ForeignKey(KPI, on_delete=models.CASCADE, related_name='measurements')
    period_label = models.CharField(max_length=50)     # e.g., "Enero 2026", "Q1 2026"
    period_date = models.DateField()                    # first day of period for ordering
    value = models.DecimalField(max_digits=12, decimal_places=2)
    comment = models.TextField(blank=True)
    recorded_by = models.CharField(max_length=255)

    class Meta:
        db_table = 'performance_kpi_measurement'
        ordering = ['-period_date']
        unique_together = ['kpi', 'period_date']
```

#### Features

- Define company, department, and individual OKRs with cascading alignment
- Key Results with measurable targets and progress tracking
- Check-in updates with history
- Standalone KPIs with configurable frequency (daily → yearly)
- Link KPIs to Quality module processes (ISO 9001 metrics)
- Dashboard: OKR tree view, KPI trends, progress by department
- Weight-based scoring at objective and key result level

#### API Endpoints

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

---

## 8. Modules — Phase 2 (Medium/Long Term)

### 8.1 Evaluaciones de Desempeño (`apps/evaluations`)

- Multi-evaluator reviews (manager, self, peers, 360°)
- Configurable evaluation forms with competency matrices
- Evaluation cycles with calibration sessions
- Score normalization and bell curve analysis
- Integration with KPIs & OKRs as quantitative input for evaluations
- Performance improvement plans (PIPs)

### 8.2 Portal del Empleado (`apps/portal`)

- Employee self-service: view profile, contracts, documents
- Request time off, view attendance, submit complaints
- Access onboarding tasks
- View org chart, department directory
- Notification center (pending tasks, approvals, announcements)
- Mobile-responsive React interface

### 8.3 Encuestas de Clima Laboral (`apps/surveys`)

- Create configurable surveys with multiple question types
- Anonymous response support
- Schedule periodic surveys (quarterly, annual)
- Real-time results dashboard with segmentation (department, tenure, position)
- Trend analysis across periods
- Action plans linked to survey results

### 8.4 Organigrama Interactivo (`apps/orgchart`)

- Auto-generated from department/position/employee data
- Interactive navigation (click to expand/collapse)
- Search and filter by department, level, location
- Export to PDF/image
- Vacancy visualization
- React component using a library like `react-org-chart` or D3

---

## 9. Project Structure

```
talent/
├── manage.py
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
├── config/
│   ├── __init__.py
│   ├── settings/
│   │   ├── base.py
│   │   ├── dev.py
│   │   └── prod.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── __init__.py
│   ├── core/                  # shared: tenant, base models, auth, permissions
│   │   ├── models.py
│   │   ├── managers.py
│   │   ├── middleware.py
│   │   ├── authentication.py
│   │   ├── permissions.py
│   │   ├── serializers.py
│   │   └── utils.py
│   ├── catalogs/               # catálogos y datos maestros
│   │   ├── models.py          # global + tenant-scoped catalogs
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── management/
│   │   │   └── commands/
│   │   │       └── seed_catalogs.py
│   │   └── fixtures/           # JSON seed data (cities, entities, etc.)
│   ├── hiring/                # contratación & onboarding
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py        # business logic
│   │   ├── signals.py
│   │   └── tests/
│   ├── personnel/             # administración de personal
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py
│   │   ├── signals.py
│   │   └── tests/
│   ├── quality/               # sistema de calidad ISO 9001
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py
│   │   └── tests/
│   └── performance/           # KPIs & OKRs
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── services.py
│       └── tests/
├── locale/
│   ├── es/
│   └── en/
└── frontend/                  # React SPA
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── public/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/               # axios client, interceptors
        ├── hooks/
        ├── contexts/          # auth context, tenant context
        ├── components/
        │   ├── common/        # buttons, tables, forms, modals, dynamic selects
        │   ├── layout/        # sidebar, header, breadcrumbs
        │   ├── catalogs/      # catalog CRUD (positions, cost centers, etc.)
        │   ├── hiring/
        │   ├── personnel/
        │   ├── quality/
        │   └── performance/   # OKR tree, KPI charts, check-in forms
        ├── pages/
        │   ├── catalogs/      # admin pages for tenant-scoped catalogs
        │   ├── hiring/
        │   ├── personnel/
        │   ├── quality/
        │   └── performance/
        ├── i18n/
        │   ├── es.json
        │   └── en.json
        └── types/
```

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

## 11. Deployment (Docker on AWS)

Talent runs as Docker containers on the same AWS EC2 instance as Nomiweb, behind the existing Nginx.

### Docker Architecture

```
AWS EC2 (Ubuntu + Nginx already running)
│
├── Nginx (host) ─── talent.nomiweb.co
│   │                    ├── /        → talent-frontend:80
│   │                    ├── /api/    → talent-backend:8000
│   │                    ├── /media/  → volume mount
│   │                    └── /static/ → volume mount
│   │
│   └── nomiweb.co       (existing Nomiweb config)
│
├── Docker containers
│   ├── talent-backend    (Django + Gunicorn)
│   ├── talent-frontend   (React built, served by Nginx)
│   ├── talent-celery     (Celery worker)
│   └── talent-redis      (Redis 7) *or shared with Nomiweb
│
├── AWS RDS (PostgreSQL 16)
│   └── db_talent          (managed by AWS, not Docker)
│
└── Volumes
    ├── talent-media
    └── talent-static
```

### Dockerfile — Backend

```dockerfile
# Dockerfile
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc gettext \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements/base.txt requirements/prod.txt ./requirements/
RUN pip install --no-cache-dir -r requirements/prod.txt

# Application code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Compile translations
RUN python manage.py compilemessages

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
```

### Dockerfile — Frontend

```dockerfile
# frontend/Dockerfile
# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=https://talent.nomiweb.co/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# frontend/nginx.conf (inside container, serves SPA)
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### docker-compose.yml

```yaml
version: "3.9"

services:
  backend:
    build: .
    container_name: talent-backend
    restart: always
    env_file: .env
    volumes:
      - talent-media:/app/media
      - talent-static:/app/staticfiles
    depends_on:
      redis:
        condition: service_started
    networks:
      - talent-network
    ports:
      - "127.0.0.1:8001:8000"

  frontend:
    build: ./frontend
    container_name: talent-frontend
    restart: always
    networks:
      - talent-network
    ports:
      - "127.0.0.1:8002:80"

  celery:
    build: .
    container_name: talent-celery
    restart: always
    env_file: .env
    command: celery -A config worker -l info --concurrency=2
    depends_on:
      - backend
      - redis
    networks:
      - talent-network

  celery-beat:
    build: .
    container_name: talent-celery-beat
    restart: always
    env_file: .env
    command: celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    depends_on:
      - backend
      - redis
    networks:
      - talent-network

  redis:
    image: redis:7-alpine
    container_name: talent-redis
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - talent-redis-data:/data
    networks:
      - talent-network

volumes:
  talent-media:
  talent-static:
  talent-redis-data:

networks:
  talent-network:
    driver: bridge
```

> **Database:** PostgreSQL lives in AWS RDS, not Docker. The backend connects via `TALENT_DB_HOST` in `.env` pointing to your RDS endpoint (e.g., `talent-db.xxxx.us-east-1.rds.amazonaws.com`). Make sure the EC2 security group allows outbound traffic to the RDS security group on port 5432.

> **Note on Redis:** If Nomiweb already has a Redis instance on the host and you want to share sessions, you have two options:
> 1. **Use the host Redis:** Remove the `redis` service from docker-compose. In `.env` set `REDIS_URL=redis://host.docker.internal:6379/1` (or `172.17.0.1` on Linux). Both apps share the same Redis.
> 2. **Use Talent's Redis:** Keep the redis container but expose port `6379` on the host (`127.0.0.1:6379:6379`). Configure Nomiweb to connect to the same Redis. This is cleaner if Nomiweb doesn't have Redis yet.

### Nginx Proxy Manager (existing on server)

Since the server already runs Nginx Proxy Manager, no manual Nginx configs are needed. Create two Proxy Hosts in the NPM admin panel:

**Proxy Host 1 — React SPA (frontend)**

```
Domain:          talent.nomiweb.co
Scheme:          http
Forward IP:      127.0.0.1
Forward Port:    8002
SSL:             Request new Let's Encrypt certificate
                 ✅ Force SSL
                 ✅ HTTP/2 Support
Custom locations:
  (none needed — default catches everything not matched by Host 2)
```

**Proxy Host 2 — Django API (backend)**

Since NPM doesn't natively support path-based routing to different backends within a single host, use the **Advanced** tab with a custom Nginx config:

```
Domain:          talent.nomiweb.co
Scheme:          http
Forward IP:      127.0.0.1
Forward Port:    8002
SSL:             Use existing certificate from Host 1

Advanced tab → Custom Nginx Configuration:
```

```nginx
# API and admin go to Django backend container
location /api/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20M;
}

location /admin/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Static and media from Docker volumes
location /static/ {
    alias /var/lib/docker/volumes/talent_talent-static/_data/;
}

location /media/ {
    alias /var/lib/docker/volumes/talent_talent-media/_data/;
    client_max_body_size 20M;
}
```

> **Alternative (simpler):** Use a single Proxy Host pointing to the frontend (port 8002). In the frontend container's Nginx config, add reverse proxy rules for `/api/` and `/admin/` to the backend container. This keeps all routing inside Docker and NPM only handles SSL + domain → port mapping.

```nginx
# frontend/nginx.conf (inside frontend container — single entry point approach)
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to backend container
    location /api/ {
        proxy_pass http://talent-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;
    }

    # Proxy admin to backend container
    location /admin/ {
        proxy_pass http://talent-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        alias /app/staticfiles/;
    }

    # Media files
    location /media/ {
        alias /app/media/;
    }
}
```

With this approach, update docker-compose.yml to mount static and media volumes into the frontend container too:

```yaml
  frontend:
    build: ./frontend
    container_name: talent-frontend
    restart: always
    volumes:
      - talent-static:/app/staticfiles:ro    # read-only mount
      - talent-media:/app/media:ro           # read-only mount
    networks:
      - talent-network
    ports:
      - "127.0.0.1:8002:80"
```

And NPM only needs one simple Proxy Host: `talent.nomiweb.co` → `127.0.0.1:8002` with SSL.

### Deployment Commands

```bash
# First deployment
cd /opt/talent
git clone <repo> .
cp .env.example .env  # edit with production values
docker compose build
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser

# Updates
git pull
docker compose build
docker compose up -d
docker compose exec backend python manage.py migrate

# Logs
docker compose logs -f backend
docker compose logs -f celery

# Database backup (from RDS — run from EC2 or any machine with access)
PGPASSWORD=$TALENT_DB_PASSWORD pg_dump -h $TALENT_DB_HOST -U $TALENT_DB_USER $TALENT_DB_NAME > backup_$(date +%Y%m%d).sql

# Database restore
PGPASSWORD=$TALENT_DB_PASSWORD psql -h $TALENT_DB_HOST -U $TALENT_DB_USER $TALENT_DB_NAME < backup.sql

# Shell access
docker compose exec backend python manage.py shell

# DB shell (connect to RDS from EC2)
PGPASSWORD=$TALENT_DB_PASSWORD psql -h $TALENT_DB_HOST -U $TALENT_DB_USER $TALENT_DB_NAME
```

### docker-compose.dev.yml (for local development)

For local development, a Postgres container is useful since you don't want to hit RDS from your laptop:

```yaml
version: "3.9"

services:
  backend:
    build: .
    container_name: talent-backend-dev
    env_file: .env.dev
    volumes:
      - .:/app                    # hot reload
      - talent-media:/app/media
    command: python manage.py runserver 0.0.0.0:8000
    ports:
      - "8001:8000"
    depends_on:
      postgres-dev:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - talent-network

  postgres-dev:
    image: postgres:16-alpine
    container_name: talent-postgres-dev
    environment:
      POSTGRES_DB: db_talent
      POSTGRES_USER: talent_user
      POSTGRES_PASSWORD: talent_dev_pass
    ports:
      - "5433:5432"               # different port to avoid conflict
    volumes:
      - talent-db-data-dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U talent_user"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - talent-network

  redis:
    image: redis:7-alpine
    container_name: talent-redis-dev
    ports:
      - "6380:6379"               # different port to avoid conflict
    networks:
      - talent-network

volumes:
  talent-db-data-dev:
  talent-media:

networks:
  talent-network:
    driver: bridge
```

```env
# .env.dev — points to local Docker postgres, not RDS
TALENT_DB_HOST=postgres-dev
TALENT_DB_PORT=5432
TALENT_DB_NAME=db_talent
TALENT_DB_USER=talent_user
TALENT_DB_PASSWORD=talent_dev_pass
REDIS_URL=redis://redis:6379/1
DJANGO_DEBUG=True
DJANGO_SETTINGS_MODULE=config.settings.dev
```

```bash
# Local development
docker compose -f docker-compose.dev.yml up -d

# Frontend runs on host for hot reload
cd frontend
npm install
npm run dev  # Vite dev server on :5173
```

---

## 12. Environment Variables

```env
# .env (production)

# Database (AWS RDS)
TALENT_DB_NAME=db_talent
TALENT_DB_USER=talent_user
TALENT_DB_PASSWORD=<secure>
TALENT_DB_HOST=talent-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com  # RDS endpoint
TALENT_DB_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/1  # Docker service name
# If sharing with Nomiweb on host: redis://host.docker.internal:6379/1

# Django
DJANGO_SECRET_KEY=<secure, must match Nomiweb for session compatibility>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=talent.nomiweb.co
DJANGO_SETTINGS_MODULE=config.settings.prod

# Session (must match Nomiweb exactly)
SESSION_COOKIE_DOMAIN=.nomiweb.co
SESSION_COOKIE_NAME=nomiweb_session

# CORS (for React SPA)
CORS_ALLOWED_ORIGINS=https://talent.nomiweb.co

# Celery
CELERY_BROKER_URL=redis://redis:6379/2

# File storage
MEDIA_ROOT=/app/media/

# Sentry (optional, recommended)
SENTRY_DSN=<your-sentry-dsn>
```

---

## 13. Development Commands

```bash
# --- Docker-based (recommended) ---

# Start dev environment
docker compose -f docker-compose.dev.yml up -d

# Run frontend dev server (on host, with hot reload)
cd frontend && npm run dev

# Run migrations
docker compose exec backend python manage.py migrate

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Run tests
docker compose exec backend pytest

# Generate API docs
docker compose exec backend python manage.py spectacular --file schema.yml

# Create translations
docker compose exec backend python manage.py makemessages -l es
docker compose exec backend python manage.py compilemessages

# Create new module
docker compose exec backend python manage.py startapp new_module apps/new_module

# View logs
docker compose logs -f backend

# --- Production ---

# Deploy update
git pull && docker compose build && docker compose up -d
docker compose exec backend python manage.py migrate

# Backup
docker compose exec postgres pg_dump -U talent_user db_talent > backup_$(date +%Y%m%d).sql
```

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
