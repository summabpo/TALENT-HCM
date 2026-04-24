import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import TimestampedTenantModel
from apps.core.managers import TenantManager
from apps.core.validators import validate_document_file, validate_image_file
from apps.catalogs.models import (
    Country, City, DocumentType, SocialSecurityEntity,
    Bank, ContractType, PayrollType, SalaryType, ContributorType,
    ContributorSubtype, Position, CostCenter, SubCostCenter,
    WorkLocation, WorkCenter, ContractTemplate, Profession,
)


class Department(TimestampedTenantModel):
    name = models.CharField(_('name'), max_length=255)
    parent = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='children',
    )
    manager = models.ForeignKey(
        'Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='managed_departments',
    )
    is_active = models.BooleanField(default=True)
    objects = TenantManager()

    class Meta:
        db_table = 'personnel_department'
        verbose_name = _('department')
        verbose_name_plural = _('departments')
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_tree(self):
        """Return self + all descendants as a nested dict."""
        return {
            'id': str(self.id),
            'name': self.name,
            'manager': str(self.manager_id) if self.manager_id else None,
            'children': [c.get_tree() for c in self.children.filter(is_active=True)],
        }


class Employee(TimestampedTenantModel):
    """
    Central employee record aligned with Nomiweb's contratosemp.
    Linked across systems via global_employee_id.
    """

    class Gender(models.TextChoices):
        MALE = 'M', _('Masculino')
        FEMALE = 'F', _('Femenino')
        OTHER = 'O', _('Otro')

    class ResumeFormat(models.TextChoices):
        PDF = 'pdf', _('PDF')
        WORD = 'word', _('Word')
        PHYSICAL = 'physical', _('Físico')

    global_employee_id = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)

    # Identity — mirrors contratosemp
    document_type = models.ForeignKey(DocumentType, on_delete=models.PROTECT)          # tipodocident
    document_number = models.BigIntegerField()                                          # docidentidad
    first_name = models.CharField(max_length=50)                                        # pnombre
    second_name = models.CharField(max_length=50, blank=True)                           # snombre
    first_last_name = models.CharField(max_length=50)                                   # papellido
    second_last_name = models.CharField(max_length=50, blank=True)                      # sapellido

    # Contact
    email = models.EmailField(blank=True)
    personal_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=12, blank=True)                                 # telefonoempleado
    cell_phone = models.CharField(max_length=12, blank=True)                            # celular
    address = models.CharField(max_length=100, blank=True)                              # direccionempleado

    # Personal data
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)         # sexo
    weight = models.CharField(_('weight (kg)'), max_length=10, blank=True)               # peso
    height = models.CharField(_('height (cm)'), max_length=10, blank=True)             # estatura
    resume_format = models.CharField(                                                    # formato hoja de vida
        _('resume format'), max_length=25, choices=ResumeFormat.choices, blank=True,
    )
    date_of_birth = models.DateField(null=True, blank=True)                             # fechanac
    birth_city = models.ForeignKey(                                                     # ciudadnacimiento
        City, on_delete=models.PROTECT, null=True, blank=True,
        related_name='employees_born',
    )
    birth_country = models.ForeignKey(                                                  # paisnacimiento
        Country, on_delete=models.PROTECT, null=True, blank=True,
        related_name='employees_born',
    )
    residence_city = models.ForeignKey(                                                 # ciudadresidencia
        City, on_delete=models.PROTECT, null=True, blank=True,
        related_name='employees_residing',
    )
    residence_country = models.ForeignKey(
        Country, on_delete=models.PROTECT, null=True, blank=True,
        related_name='employees_residing',
    )
    marital_status = models.CharField(max_length=20, blank=True)                        # estadocivil
    blood_type = models.CharField(max_length=10, blank=True)                            # gruposanguineo
    socioeconomic_stratum = models.CharField(max_length=5, blank=True)                  # estrato

    # Academic & professional
    profession = models.ForeignKey(Profession, on_delete=models.PROTECT, null=True, blank=True)
    education_level = models.CharField(max_length=25, blank=True)                       # niveleducativo

    # ID document details
    document_expedition_date = models.DateField(null=True, blank=True)                  # fechaexpedicion
    document_expedition_city = models.ForeignKey(                                       # ciudadexpedicion
        City, on_delete=models.PROTECT, null=True, blank=True,
        related_name='employees_expedition',
    )

    # Military service card (Colombia)
    num_libreta_militar = models.CharField(max_length=10, blank=True)                   # nolibretamilitar

    # Uniform sizes — mirrors contratosemp dotación fields
    uniform_pants = models.CharField(max_length=10, blank=True)                         # dotpantalon
    uniform_shirt = models.CharField(max_length=10, blank=True)                         # dotcamisa
    uniform_shoes = models.CharField(max_length=10, blank=True)                         # dotzapatos

    # Emergency contact
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_relationship = models.CharField(max_length=20, blank=True)

    # Photo
    photo = models.ImageField(
        upload_to='employees/photos/', blank=True, null=True,
        validators=[validate_image_file],
    )
    # CV (single PDF, Talent UI); resume_format may mirror Nomiweb as pdf|word|physical
    resume_file = models.FileField(
        _('resume file (PDF)'), upload_to='employees/resumes/', blank=True, null=True,
        validators=[validate_document_file],
    )

    # Organizational (Talent-native)
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, null=True, blank=True,
    )
    direct_manager = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='direct_reports',
    )
    employee_number = models.CharField(max_length=30, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=[
        ('active', _('Active')),
        ('inactive', _('Inactive')),
        ('on_leave', _('On Leave')),
        ('terminated', _('Terminated')),
    ], default='active')
    is_active = models.BooleanField(default=True)

    nomiweb_empleado_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        unique=True,
        help_text='ID del registro equivalente en Nomiweb (contratosemp.idempleado)',
    )

    objects = TenantManager()

    class Meta:
        db_table = 'personnel_employee'
        verbose_name = _('employee')
        verbose_name_plural = _('employees')
        indexes = [
            models.Index(fields=['tenant', 'document_number']),
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['global_employee_id']),
        ]

    def __str__(self):
        return self.full_name

    @property
    def full_name(self):
        parts = [self.first_name, self.second_name, self.first_last_name, self.second_last_name]
        return ' '.join(p for p in parts if p)


class Contract(TimestampedTenantModel):
    """Mirrors Nomiweb's contratos table for future API sync."""

    class PaymentMethod(models.TextChoices):
        TRANSFER = 'transfer', _('Transferencia')
        CHECK = 'check', _('Cheque')
        CASH = 'cash', _('Efectivo')

    class PensionerStatus(models.TextChoices):
        NOT_APPLICABLE = 'not_applicable', _('No aplica')
        ACTIVE = 'active', _('Pensionado activo')
        SUBSTITUTION = 'substitution', _('Sustitución')

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='contracts')

    # Contract basics
    contract_type = models.ForeignKey(ContractType, on_delete=models.PROTECT)           # tipocontrato
    contract_template = models.ForeignKey(                                               # idmodelo
        ContractTemplate, on_delete=models.PROTECT, null=True, blank=True,
    )
    start_date = models.DateField()                                                      # fechainiciocontrato
    end_date = models.DateField(null=True, blank=True)                                   # fechafincontrato
    hiring_city = models.ForeignKey(                                                     # ciudadcontratacion
        City, on_delete=models.PROTECT, null=True, blank=True,
    )

    # Compensation
    payroll_type = models.ForeignKey(                                                    # tiponómina
        PayrollType, on_delete=models.PROTECT, null=True, blank=True,
    )
    salary = models.DecimalField(max_digits=12, decimal_places=2)                       # salario
    salary_type = models.ForeignKey(SalaryType, on_delete=models.PROTECT, null=True, blank=True)  # tiposalario
    salary_mode = models.CharField(max_length=10, choices=[                             # salariovariable
        ('fixed', _('Fijo')),
        ('variable', _('Variable')),
        ('mixed', _('Mixto')),
    ], default='fixed')
    transport_allowance = models.BooleanField(default=False)                             # auxiliotransporte
    payment_method = models.CharField(                                                    # formapago
        max_length=25, choices=PaymentMethod.choices, blank=True,
    )
    work_schedule = models.CharField(max_length=25, blank=True)                         # jornada

    # Banking
    bank = models.ForeignKey(Bank, on_delete=models.PROTECT, null=True, blank=True)     # bancocuenta
    bank_account_number = models.CharField(max_length=30, blank=True)                   # cuentanomina
    bank_account_type = models.CharField(max_length=15, blank=True)                     # tipocuentanomina

    # Position & assignment
    position = models.ForeignKey(Position, on_delete=models.PROTECT)                    # cargo
    cost_center = models.ForeignKey(                                                     # idcosto
        CostCenter, on_delete=models.PROTECT, null=True, blank=True,
    )
    sub_cost_center = models.ForeignKey(                                                 # idsubcosto
        SubCostCenter, on_delete=models.PROTECT, null=True, blank=True,
    )
    work_location = models.ForeignKey(                                                   # idsede
        WorkLocation, on_delete=models.PROTECT, null=True, blank=True,
    )
    work_center = models.ForeignKey(WorkCenter, on_delete=models.PROTECT)               # centrotrabajo

    # Social security
    eps = models.ForeignKey(                                                             # codeps
        SocialSecurityEntity, on_delete=models.PROTECT,
        related_name='contracts_eps',
        limit_choices_to={'entity_type': 'EPS'},
    )
    afp = models.ForeignKey(                                                             # codafp
        SocialSecurityEntity, on_delete=models.PROTECT,
        related_name='contracts_afp',
        null=True, blank=True,
        limit_choices_to={'entity_type': 'AFP'},
    )
    ccf = models.ForeignKey(                                                             # codccf
        SocialSecurityEntity, on_delete=models.PROTECT,
        related_name='contracts_ccf',
        limit_choices_to={'entity_type': 'CCF'},
    )
    severance_fund = models.ForeignKey(                                                  # fondocesantias
        SocialSecurityEntity, on_delete=models.PROTECT,
        related_name='contracts_severance',
        null=True, blank=True,
        limit_choices_to={'entity_type': 'CESANTIAS'},
    )

    # Contributor type (PILA)
    contributor_type = models.ForeignKey(ContributorType, on_delete=models.PROTECT)     # tipocotizante
    contributor_subtype = models.ForeignKey(                                             # subtipocotizante
        ContributorSubtype, on_delete=models.PROTECT, null=True, blank=True,
    )

    # Withholding tax
    withholding_method = models.CharField(max_length=25, blank=True)                    # metodoretefuente
    withholding_percentage = models.DecimalField(                                        # porcentajeretefuente
        max_digits=5, decimal_places=2, null=True, blank=True,
    )
    housing_deductible = models.IntegerField(null=True, blank=True)                     # valordeduciblevivienda
    health_deductible = models.IntegerField(null=True, blank=True)                      # saludretefuente
    medical_deductible = models.IntegerField(null=True, blank=True)                     # valordeduciblemedicina
    dependents = models.SmallIntegerField(null=True, blank=True)                        # dependientes

    # Status
    contract_status = models.SmallIntegerField(default=1)                               # estadocontrato 1=active 2=terminated
    settlement_status = models.CharField(max_length=25, blank=True)                     # estadoliquidacion
    social_security_status = models.CharField(max_length=25, blank=True)                # estadosegsocial
    is_pensioner = models.CharField(                                                     # pensionado
        max_length=25, choices=PensionerStatus.choices, blank=True,
    )
    pension_risk = models.BooleanField(default=False)                                   # riesgo_pension
    is_current = models.BooleanField(default=True)

    legacy_contract_id = models.CharField(                                              # id contrato sistema anterior
        _('legacy contract id'), max_length=25, blank=True,
    )

    # Document
    document = models.FileField(
        upload_to='personnel/contracts/', blank=True,
        validators=[validate_document_file],
    )
    notes = models.TextField(blank=True)

    nomiweb_contrato_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        unique=True,
        help_text='ID del registro equivalente en Nomiweb (contratos.idcontrato)',
    )

    objects = TenantManager()

    class Meta:
        db_table = 'personnel_contract'
        verbose_name = _('contract')
        verbose_name_plural = _('contracts')
        ordering = ['-start_date']

    def __str__(self):
        return f'{self.employee.full_name} — {self.start_date}'

    def save(self, *args, **kwargs):
        if self.is_current:
            # Only one current contract per employee
            Contract.objects.filter(
                employee=self.employee, is_current=True,
            ).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class EmployeeDocument(TimestampedTenantModel):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=[
        ('id_copy', _('Copia Documento de Identidad')),
        ('rut', 'RUT'),
        ('bank_cert', _('Certificación Bancaria')),
        ('health_cert', _('Certificado de Salud')),
        ('education', _('Certificado de Educación')),
        ('background', _('Antecedentes')),
        ('resume', _('Hoja de Vida')),
        ('military_card', _('Libreta Militar')),
        ('other', _('Otro')),
    ])
    title = models.CharField(max_length=255)
    file = models.FileField(
        upload_to='personnel/documents/',
        validators=[validate_document_file],
    )
    expiration_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    objects = TenantManager()

    class Meta:
        db_table = 'personnel_document'
        verbose_name = _('employee document')
        verbose_name_plural = _('employee documents')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.employee.full_name} — {self.title}'


class EmployeeHistory(TimestampedTenantModel):
    """Audit trail for employee field changes."""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='history')
    change_type = models.CharField(max_length=30)   # promotion, transfer, salary_change, status_change, etc.
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    changed_by = models.CharField(max_length=255)
    reason = models.TextField(blank=True)

    objects = TenantManager()

    class Meta:
        db_table = 'personnel_history'
        verbose_name = _('employee history')
        verbose_name_plural = _('employee history')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.employee.full_name} — {self.change_type} — {self.created_at:%Y-%m-%d}'
