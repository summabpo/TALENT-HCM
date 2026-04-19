# Talent HCM — Module Models (Hiring, Personnel, Quality, Performance)

All Django models for Phase 1 feature modules.
Referenced by CLAUDE.md.

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


---

