from rest_framework import viewsets, mixins, filters
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import HasTenant, IsDjangoSuperuser
from .models import (
    Country, StateProvince, City, DocumentType, SocialSecurityEntity,
    Bank, ContractType, PayrollType, SalaryType, ContributorType, ContributorSubtype,
    Diagnosis, AbsenceType, Holiday, Profession, ContractTemplate,
    OrganizationalLevel, Position, CostCenter, SubCostCenter,
    WorkLocation, WorkCenter,
)
from .serializers import (
    CountrySerializer, StateProvinceSerializer, CitySerializer,
    DocumentTypeSerializer, SocialSecurityEntitySerializer, BankSerializer,
    ContractTypeSerializer, PayrollTypeSerializer, SalaryTypeSerializer,
    ContributorTypeSerializer, ContributorSubtypeSerializer,
    DiagnosisSerializer, AbsenceTypeSerializer,
    HolidaySerializer, ProfessionSerializer, ContractTemplateSerializer,
    OrganizationalLevelSerializer, PositionSerializer, CostCenterSerializer,
    SubCostCenterSerializer, WorkLocationSerializer, WorkCenterSerializer,
)


class ReadOnlyViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]


class GlobalCatalogViewSet(viewsets.ModelViewSet):
    """
    Catálogos globales.
    READ: usuario autenticado (p. ej. tenant para selects, staff para admin).
    WRITE: solo superusuario (is_superuser); tenants no alteran referencias maestras.
    DELETE: soft-delete — is_active=False.
    """
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsDjangoSuperuser()]

    def get_queryset(self):
        qs = super().get_queryset()
        # Staff see all; regular users only see active records
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class TenantCRUDViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasTenant]

    def get_queryset(self):
        return super().get_queryset().for_tenant(self.request.tenant)


# Global catalogs — CRUD for staff, read-only for authenticated users

class CountryViewSet(GlobalCatalogViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    search_fields = ['name', 'iso_code']
    ordering_fields = ['name', 'iso_code']


class StateProvinceViewSet(GlobalCatalogViewSet):
    queryset = StateProvince.objects.select_related('country').all()
    serializer_class = StateProvinceSerializer
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'code']

    def get_queryset(self):
        qs = super().get_queryset()
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country_id=country)
        return qs


class CityViewSet(GlobalCatalogViewSet):
    queryset = City.objects.select_related('state_province', 'state_province__country').all()
    serializer_class = CitySerializer
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'code']

    def get_queryset(self):
        qs = super().get_queryset()
        state = self.request.query_params.get('state')
        if state:
            qs = qs.filter(state_province_id=state)
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(state_province__country_id=country)
        return qs


class DocumentTypeViewSet(GlobalCatalogViewSet):
    queryset = DocumentType.objects.all()
    serializer_class = DocumentTypeSerializer
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'code']


class SocialSecurityEntityViewSet(GlobalCatalogViewSet):
    queryset = SocialSecurityEntity.objects.all()
    serializer_class = SocialSecurityEntitySerializer
    search_fields = ['name', 'code', 'nit']
    ordering_fields = ['entity_type', 'name']

    def get_queryset(self):
        qs = super().get_queryset()
        entity_type = self.request.query_params.get('type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        return qs


class BankViewSet(GlobalCatalogViewSet):
    queryset = Bank.objects.all()
    serializer_class = BankSerializer
    search_fields = ['name', 'code', 'nit']
    ordering_fields = ['name', 'code']


class ContractTypeViewSet(ReadOnlyViewSet):
    queryset = ContractType.objects.all()
    serializer_class = ContractTypeSerializer


class PayrollTypeViewSet(ReadOnlyViewSet):
    queryset = PayrollType.objects.filter(activo=True)
    serializer_class = PayrollTypeSerializer


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
