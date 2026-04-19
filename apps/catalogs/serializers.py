from rest_framework import serializers
from apps.core.serializers import TenantSerializer
from .models import (
    Country, StateProvince, City, DocumentType, SocialSecurityEntity,
    Bank, ContractType, SalaryType, ContributorType, ContributorSubtype,
    Diagnosis, AbsenceType, Holiday, Profession, ContractTemplate,
    OrganizationalLevel, Position, CostCenter, SubCostCenter,
    WorkLocation, WorkCenter,
)


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'name', 'iso_code']


class StateProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StateProvince
        fields = ['id', 'name', 'code', 'country']


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name', 'code', 'state_province']


class DocumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentType
        fields = ['id', 'name', 'code', 'dian_code']


class SocialSecurityEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialSecurityEntity
        fields = ['id', 'code', 'nit', 'name', 'entity_type', 'sgp_code']


class BankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bank
        fields = ['id', 'name', 'code', 'ach_code', 'nit']


class ContractTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractType
        fields = ['id', 'name', 'dian_code']


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
        fields = ['id', 'name', 'level', 'is_active', 'tenant', 'created_at', 'updated_at']


class CostCenterSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = CostCenter
        fields = ['id', 'name', 'accounting_group', 'suffix', 'is_active', 'tenant', 'created_at', 'updated_at']


class SubCostCenterSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = SubCostCenter
        fields = ['id', 'name', 'cost_center', 'suffix', 'is_active', 'tenant', 'created_at', 'updated_at']


class WorkLocationSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = WorkLocation
        fields = ['id', 'name', 'compensation_fund', 'is_active', 'tenant', 'created_at', 'updated_at']


class WorkCenterSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = WorkCenter
        fields = ['id', 'name', 'arl_rate', 'economic_activity', 'operator_code', 'is_active', 'tenant', 'created_at', 'updated_at']
