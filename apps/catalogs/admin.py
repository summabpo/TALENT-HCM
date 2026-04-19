from django.contrib import admin
from .models import (
    Country, StateProvince, City,
    DocumentType, SocialSecurityEntity, Bank,
    ContractType, SalaryType, ContributorType, ContributorSubtype,
    Diagnosis, AbsenceType, Holiday, Profession, ContractTemplate,
    OrganizationalLevel, Position, CostCenter, SubCostCenter,
    WorkLocation, WorkCenter,
)

# ── Global catalogs ───────────────────────────────────────────────────────────

@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ['name', 'iso_code']
    search_fields = ['name', 'iso_code']


@admin.register(StateProvince)
class StateProvinceAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'country']
    list_filter = ['country']
    search_fields = ['name', 'code']


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'state_province']
    list_filter = ['state_province__country']
    search_fields = ['name', 'code']


@admin.register(DocumentType)
class DocumentTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'dian_code']


@admin.register(SocialSecurityEntity)
class SocialSecurityEntityAdmin(admin.ModelAdmin):
    list_display = ['entity_type', 'code', 'name', 'nit']
    list_filter = ['entity_type']
    search_fields = ['name', 'nit', 'code']


@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'ach_code']
    search_fields = ['name', 'code']


@admin.register(ContractType)
class ContractTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'dian_code']


@admin.register(SalaryType)
class SalaryTypeAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']


@admin.register(ContributorType)
class ContributorTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'description', 'form_code']


@admin.register(ContributorSubtype)
class ContributorSubtypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'description', 'form_code']


@admin.register(Diagnosis)
class DiagnosisAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'prefix']
    search_fields = ['code', 'name']


@admin.register(AbsenceType)
class AbsenceTypeAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'year', 'country']
    list_filter = ['year', 'country']


@admin.register(Profession)
class ProfessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']


@admin.register(ContractTemplate)
class ContractTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'contract_type', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']


# ── Tenant-scoped catalogs ────────────────────────────────────────────────────

class TenantModelAdmin(admin.ModelAdmin):
    list_filter = ['tenant']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant')


@admin.register(OrganizationalLevel)
class OrganizationalLevelAdmin(TenantModelAdmin):
    list_display = ['name', 'tenant']
    search_fields = ['name']


@admin.register(Position)
class PositionAdmin(TenantModelAdmin):
    list_display = ['name', 'level', 'tenant', 'is_active']
    list_filter = ['is_active', 'tenant']
    search_fields = ['name']


@admin.register(CostCenter)
class CostCenterAdmin(TenantModelAdmin):
    list_display = ['name', 'tenant', 'accounting_group', 'is_active']
    list_filter = ['is_active', 'tenant']


@admin.register(SubCostCenter)
class SubCostCenterAdmin(TenantModelAdmin):
    list_display = ['name', 'cost_center', 'tenant', 'is_active']
    list_filter = ['is_active', 'tenant']


@admin.register(WorkLocation)
class WorkLocationAdmin(TenantModelAdmin):
    list_display = ['name', 'tenant', 'is_active']
    list_filter = ['is_active', 'tenant']


@admin.register(WorkCenter)
class WorkCenterAdmin(TenantModelAdmin):
    list_display = ['name', 'tenant', 'arl_rate', 'is_active']
    list_filter = ['is_active', 'tenant']
