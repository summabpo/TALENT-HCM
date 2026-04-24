from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import TimestampedTenantModel
from apps.core.managers import TenantManager


# ============================================================
# GLOBAL CATALOGS — shared across all tenants, no tenant_id
# Mirror Nomiweb's existing tables for future API sync
# ============================================================

class Country(models.Model):
    """Mirrors Nomiweb: paises"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    iso_code = models.CharField(max_length=3, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_country'
        verbose_name = _('country')
        verbose_name_plural = _('countries')
        ordering = ['name']

    def __str__(self):
        return self.name


class StateProvince(models.Model):
    """Colombian departments. Mirrors Nomiweb: ciudades.coddepartamento"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=10)
    country = models.ForeignKey(Country, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_state_province'
        ordering = ['name']

    def __str__(self):
        return self.name


class City(models.Model):
    """Mirrors Nomiweb: ciudades"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=10)
    state_province = models.ForeignKey(StateProvince, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_city'
        verbose_name = _('city')
        verbose_name_plural = _('cities')
        ordering = ['name']

    def __str__(self):
        return f'{self.name}, {self.state_province.name}'


class DocumentType(models.Model):
    """Mirrors Nomiweb: tipodocumento"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=4)
    dian_code = models.SmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_document_type'
        ordering = ['name']

    def __str__(self):
        return f'{self.code} - {self.name}'


class SocialSecurityEntityType(models.TextChoices):
    EPS = 'EPS', 'EPS'
    AFP = 'AFP', _('Fondo de Pensiones')
    ARL = 'ARL', 'ARL'
    CCF = 'CCF', _('Caja de Compensación')
    CESANTIAS = 'CESANTIAS', _('Fondo de Cesantías')


class SocialSecurityEntity(models.Model):
    """Mirrors Nomiweb: entidadessegsocial"""
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=9)
    nit = models.CharField(max_length=12)
    name = models.CharField(max_length=120)
    entity_type = models.CharField(max_length=20, choices=SocialSecurityEntityType.choices)
    sgp_code = models.CharField(max_length=10, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_social_security_entity'
        ordering = ['entity_type', 'name']

    def __str__(self):
        return f'{self.entity_type} - {self.name}'


class Bank(models.Model):
    """Mirrors Nomiweb: bancos"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10)
    ach_code = models.CharField(max_length=10, blank=True)
    nit = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_bank'
        ordering = ['name']

    def __str__(self):
        return self.name


class ContractType(models.Model):
    """Mirrors Nomiweb: tipocontrato"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    dian_code = models.SmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'catalog_contract_type'
        ordering = ['name']

    def __str__(self):
        return self.name


class PayrollType(models.Model):
    """Frecuencia de liquidación de nómina. Mirrors Nomiweb: tiponómina"""
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=40)
    cod_dian = models.SmallIntegerField(null=True, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_payroll_type'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class SalaryType(models.Model):
    """Mirrors Nomiweb: tiposalario"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=40)

    class Meta:
        db_table = 'catalog_salary_type'
        ordering = ['name']

    def __str__(self):
        return self.name


class ContributorType(models.Model):
    """Mirrors Nomiweb: tiposdecotizantes"""
    code = models.CharField(primary_key=True, max_length=2)
    description = models.CharField(max_length=120)
    form_code = models.SmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'catalog_contributor_type'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.description}'


class ContributorSubtype(models.Model):
    """Mirrors Nomiweb: subtipocotizantes"""
    code = models.CharField(primary_key=True, max_length=2)
    description = models.CharField(max_length=100)
    form_code = models.SmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'catalog_contributor_subtype'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.description}'


class Diagnosis(models.Model):
    """ICD-10 codes. Mirrors Nomiweb: diagnosticosenfermedades"""
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=255)
    prefix = models.CharField(max_length=1)

    class Meta:
        db_table = 'catalog_diagnosis'
        verbose_name_plural = _('diagnoses')
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.name}'


class AbsenceType(models.Model):
    """Mirrors Nomiweb: ausencias"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)

    class Meta:
        db_table = 'catalog_absence_type'
        ordering = ['name']

    def __str__(self):
        return self.name


class Holiday(models.Model):
    """Mirrors Nomiweb: festivos"""
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    description = models.CharField(max_length=60, blank=True)
    year = models.SmallIntegerField()
    country = models.ForeignKey(Country, on_delete=models.PROTECT, default=1)

    class Meta:
        db_table = 'catalog_holiday'
        ordering = ['date']

    def __str__(self):
        return f'{self.date} - {self.description}'


class Profession(models.Model):
    """Mirrors Nomiweb: profesiones"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=180)

    class Meta:
        db_table = 'catalog_profession'
        ordering = ['name']

    def __str__(self):
        return self.name


class ContractTemplate(models.Model):
    """Mirrors Nomiweb: modelos_contratos"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    contract_type = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalog_contract_template'
        ordering = ['name']

    def __str__(self):
        return self.name


# ============================================================
# TENANT-SCOPED CATALOGS — each company has its own
# ============================================================

class OrganizationalLevel(TimestampedTenantModel):
    """Mirrors Nomiweb: nivelesestructura — per tenant in Talent"""
    name = models.CharField(max_length=50)
    objects = TenantManager()

    class Meta:
        db_table = 'catalog_organizational_level'
        ordering = ['name']

    def __str__(self):
        return self.name


class Position(TimestampedTenantModel):
    """Mirrors Nomiweb: cargos"""
    name = models.CharField(max_length=100)
    level = models.ForeignKey(OrganizationalLevel, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)
    nomiweb_cargo_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text='ID del registro equivalente en Nomiweb (cargos.idcargo)',
    )
    objects = TenantManager()

    class Meta:
        db_table = 'catalog_position'
        ordering = ['name']
        unique_together = [['tenant', 'nomiweb_cargo_id']]

    def __str__(self):
        return self.name


class CostCenter(TimestampedTenantModel):
    """Mirrors Nomiweb: costos"""
    name = models.CharField(max_length=60)
    accounting_group = models.CharField(max_length=4, blank=True)
    suffix = models.CharField(max_length=2, blank=True)
    is_active = models.BooleanField(default=True)
    nomiweb_costo_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text='ID del registro equivalente en Nomiweb (costos.idcosto)',
    )
    objects = TenantManager()

    class Meta:
        db_table = 'catalog_cost_center'
        ordering = ['name']
        unique_together = [['tenant', 'nomiweb_costo_id']]

    def __str__(self):
        return self.name


class SubCostCenter(TimestampedTenantModel):
    """Mirrors Nomiweb: subcostos"""
    name = models.CharField(max_length=60)
    cost_center = models.ForeignKey(CostCenter, on_delete=models.CASCADE)
    suffix = models.CharField(max_length=2, blank=True)
    is_active = models.BooleanField(default=True)
    nomiweb_subcosto_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text='ID del registro equivalente en Nomiweb (subcostos.idsubcosto)',
    )
    objects = TenantManager()

    class Meta:
        db_table = 'catalog_sub_cost_center'
        ordering = ['cost_center__name', 'name']
        unique_together = [['tenant', 'nomiweb_subcosto_id']]

    def __str__(self):
        return f'{self.cost_center.name} > {self.name}'


class WorkLocation(TimestampedTenantModel):
    """Mirrors Nomiweb: sedes"""
    name = models.CharField(max_length=40)
    compensation_fund = models.ForeignKey(
        SocialSecurityEntity,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        limit_choices_to={'entity_type': 'CCF'},
    )
    is_active = models.BooleanField(default=True)
    nomiweb_sede_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text='ID del registro equivalente en Nomiweb (sedes.idsede)',
    )
    objects = TenantManager()

    class Meta:
        db_table = 'catalog_work_location'
        ordering = ['name']
        unique_together = [['tenant', 'nomiweb_sede_id']]

    def __str__(self):
        return self.name


class WorkCenter(TimestampedTenantModel):
    """Mirrors Nomiweb: centrotrabajo"""
    name = models.CharField(max_length=60)
    arl_rate = models.DecimalField(max_digits=5, decimal_places=3)
    economic_activity = models.CharField(max_length=7, blank=True)
    operator_code = models.CharField(max_length=7, blank=True)
    is_active = models.BooleanField(default=True)
    nomiweb_ct_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text='ID del registro equivalente en Nomiweb (centrotrabajo.centrotrabajo)',
    )
    objects = TenantManager()

    class Meta:
        db_table = 'catalog_work_center'
        ordering = ['name']
        unique_together = [['tenant', 'nomiweb_ct_id']]

    def __str__(self):
        return self.name
