from rest_framework import serializers
from apps.core.serializers import TenantSerializer
from .models import (
    Country, StateProvince, City, DocumentType, SocialSecurityEntity,
    Bank, ContractType, PayrollType, SalaryType, ContributorType, ContributorSubtype,
    Diagnosis, AbsenceType, Holiday, Profession, ContractTemplate,
    OrganizationalLevel, Position, CostCenter, SubCostCenter,
    WorkLocation, WorkCenter,
)


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'name', 'iso_code', 'is_active']


class StateProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StateProvince
        fields = ['id', 'name', 'code', 'country', 'is_active']


class CitySerializer(serializers.ModelSerializer):
    state_province_name = serializers.CharField(source='state_province.name', read_only=True)

    class Meta:
        model = City
        fields = ['id', 'name', 'code', 'state_province', 'state_province_name', 'is_active']


class DocumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentType
        fields = ['id', 'name', 'code', 'dian_code', 'is_active']


class SocialSecurityEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialSecurityEntity
        fields = ['id', 'code', 'nit', 'name', 'entity_type', 'sgp_code', 'is_active']


class BankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bank
        fields = ['id', 'name', 'code', 'ach_code', 'nit', 'is_active']


class ContractTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractType
        fields = ['id', 'name', 'dian_code']


class PayrollTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollType
        fields = ['id', 'nombre', 'cod_dian', 'activo']


class SalaryTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryType
        fields = ['id', 'name']


class ContributorTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributorType
        fields = ['code', 'description', 'form_code']


class ContributorSubtypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributorSubtype
        fields = ['code', 'description', 'form_code']


class DiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnosis
        fields = ['id', 'code', 'name', 'prefix']


class AbsenceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbsenceType
        fields = ['id', 'name']


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'date', 'description', 'year', 'country']


class ProfessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profession
        fields = ['id', 'name']


class ContractTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractTemplate
        fields = ['id', 'name', 'contract_type', 'is_active']


# Tenant-scoped serializers

class OrganizationalLevelSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = OrganizationalLevel
        fields = ['id', 'name', 'tenant', 'created_at', 'updated_at']


class PositionSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = Position
        fields = ['id', 'name', 'level', 'is_active', 'tenant', 'created_at', 'updated_at', 'nomiweb_cargo_id']
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['nomiweb_cargo_id']


class CostCenterSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = CostCenter
        fields = ['id', 'name', 'accounting_group', 'suffix', 'is_active', 'tenant', 'created_at', 'updated_at', 'nomiweb_costo_id']
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['nomiweb_costo_id']


class SubCostCenterSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = SubCostCenter
        fields = ['id', 'name', 'cost_center', 'suffix', 'is_active', 'tenant', 'created_at', 'updated_at', 'nomiweb_subcosto_id']
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['nomiweb_subcosto_id']


class WorkLocationSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = WorkLocation
        fields = ['id', 'name', 'compensation_fund', 'is_active', 'tenant', 'created_at', 'updated_at', 'nomiweb_sede_id']
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['nomiweb_sede_id']


class WorkCenterSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = WorkCenter
        fields = ['id', 'name', 'arl_rate', 'economic_activity', 'operator_code', 'is_active', 'tenant', 'created_at', 'updated_at', 'nomiweb_ct_id']
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['nomiweb_ct_id']
