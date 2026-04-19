# Talent HCM — Core, Auth & Catalogs Models

Multi-tenancy base, authentication, and catalog definitions.
Referenced by CLAUDE.md.

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


---

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


---