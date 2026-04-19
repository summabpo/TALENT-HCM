from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import HasTenant
from .models import (
    Country, StateProvince, City, DocumentType, SocialSecurityEntity,
    Bank, ContractType, SalaryType, ContributorType, ContributorSubtype,
    Diagnosis, AbsenceType, Holiday, Profession, ContractTemplate,
    OrganizationalLevel, Position, CostCenter, SubCostCenter,
    WorkLocation, WorkCenter,
)
from .serializers import (
    CountrySerializer, StateProvinceSerializer, CitySerializer,
    DocumentTypeSerializer, SocialSecurityEntitySerializer, BankSerializer,
    ContractTypeSerializer, SalaryTypeSerializer, ContributorTypeSerializer,
    ContributorSubtypeSerializer, DiagnosisSerializer, AbsenceTypeSerializer,
    HolidaySerializer, ProfessionSerializer, ContractTemplateSerializer,
    OrganizationalLevelSerializer, PositionSerializer, CostCenterSerializer,
    SubCostCenterSerializer, WorkLocationSerializer, WorkCenterSerializer,
)


class ReadOnlyViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]


class TenantCRUDViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasTenant]

    def get_queryset(self):
        return super().get_queryset().for_tenant(self.request.tenant)


# Global catalogs (read-only)

class CountryViewSet(ReadOnlyViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer


class StateProvinceViewSet(ReadOnlyViewSet):
    queryset = StateProvince.objects.select_related('country').all()
    serializer_class = StateProvinceSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country_id=country)
        return qs


class CityViewSet(ReadOnlyViewSet):
    queryset = City.objects.select_related('state_province').all()
    serializer_class = CitySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        state = self.request.query_params.get('state')
        if state:
            qs = qs.filter(state_province_id=state)
        return qs


class DocumentTypeViewSet(ReadOnlyViewSet):
    queryset = DocumentType.objects.all()
    serializer_class = DocumentTypeSerializer


class SocialSecurityEntityViewSet(ReadOnlyViewSet):
    queryset = SocialSecurityEntity.objects.all()
    serializer_class = SocialSecurityEntitySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        entity_type = self.request.query_params.get('type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        return qs


class BankViewSet(ReadOnlyViewSet):
    queryset = Bank.objects.all()
    serializer_class = BankSerializer


class ContractTypeViewSet(ReadOnlyViewSet):
    queryset = ContractType.objects.all()
    serializer_class = ContractTypeSerializer


class SalaryTypeViewSet(ReadOnlyViewSet):
    queryset = SalaryType.objects.all()
    serializer_class = SalaryTypeSerializer


class ContributorTypeViewSet(ReadOnlyViewSet):
    queryset = ContributorType.objects.all()
    serializer_class = ContributorTypeSerializer


class ContributorSubtypeViewSet(ReadOnlyViewSet):
    queryset = ContributorSubtype.objects.all()
    serializer_class = ContributorSubtypeSerializer


class DiagnosisViewSet(ReadOnlyViewSet):
    queryset = Diagnosis.objects.all()
    serializer_class = DiagnosisSerializer


class AbsenceTypeViewSet(ReadOnlyViewSet):
    queryset = AbsenceType.objects.all()
    serializer_class = AbsenceTypeSerializer


class HolidayViewSet(ReadOnlyViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(year=year)
        return qs


class ProfessionViewSet(ReadOnlyViewSet):
    queryset = Profession.objects.all()
    serializer_class = ProfessionSerializer


class ContractTemplateViewSet(ReadOnlyViewSet):
    queryset = ContractTemplate.objects.filter(is_active=True)
    serializer_class = ContractTemplateSerializer


# Tenant-scoped catalogs (CRUD)

class OrganizationalLevelViewSet(TenantCRUDViewSet):
    queryset = OrganizationalLevel.objects.all()
    serializer_class = OrganizationalLevelSerializer


class PositionViewSet(TenantCRUDViewSet):
    queryset = Position.objects.select_related('level').all()
    serializer_class = PositionSerializer


class CostCenterViewSet(TenantCRUDViewSet):
    queryset = CostCenter.objects.all()
    serializer_class = CostCenterSerializer


class SubCostCenterViewSet(TenantCRUDViewSet):
    queryset = SubCostCenter.objects.select_related('cost_center').all()
    serializer_class = SubCostCenterSerializer


class WorkLocationViewSet(TenantCRUDViewSet):
    queryset = WorkLocation.objects.all()
    serializer_class = WorkLocationSerializer


class WorkCenterViewSet(TenantCRUDViewSet):
    queryset = WorkCenter.objects.all()
    serializer_class = WorkCenterSerializer
