from rest_framework.routers import DefaultRouter
from .views import (
    CountryViewSet, StateProvinceViewSet, CityViewSet, DocumentTypeViewSet,
    SocialSecurityEntityViewSet, BankViewSet, ContractTypeViewSet,
    SalaryTypeViewSet, ContributorTypeViewSet, ContributorSubtypeViewSet,
    DiagnosisViewSet, AbsenceTypeViewSet, HolidayViewSet, ProfessionViewSet,
    ContractTemplateViewSet, OrganizationalLevelViewSet, PositionViewSet,
    CostCenterViewSet, SubCostCenterViewSet, WorkLocationViewSet, WorkCenterViewSet,
)

router = DefaultRouter()
router.register('countries', CountryViewSet, basename='country')
router.register('states', StateProvinceViewSet, basename='state')
router.register('cities', CityViewSet, basename='city')
router.register('document-types', DocumentTypeViewSet, basename='document-type')
router.register('social-security-entities', SocialSecurityEntityViewSet, basename='social-security-entity')
router.register('banks', BankViewSet, basename='bank')
router.register('contract-types', ContractTypeViewSet, basename='contract-type')
router.register('salary-types', SalaryTypeViewSet, basename='salary-type')
router.register('contributor-types', ContributorTypeViewSet, basename='contributor-type')
router.register('contributor-subtypes', ContributorSubtypeViewSet, basename='contributor-subtype')
router.register('diagnoses', DiagnosisViewSet, basename='diagnosis')
router.register('absence-types', AbsenceTypeViewSet, basename='absence-type')
router.register('holidays', HolidayViewSet, basename='holiday')
router.register('professions', ProfessionViewSet, basename='profession')
router.register('contract-templates', ContractTemplateViewSet, basename='contract-template')
router.register('organizational-levels', OrganizationalLevelViewSet, basename='organizational-level')
router.register('positions', PositionViewSet, basename='position')
router.register('cost-centers', CostCenterViewSet, basename='cost-center')
router.register('sub-cost-centers', SubCostCenterViewSet, basename='sub-cost-center')
router.register('work-locations', WorkLocationViewSet, basename='work-location')
router.register('work-centers', WorkCenterViewSet, basename='work-center')

urlpatterns = router.urls
