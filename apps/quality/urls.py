from rest_framework.routers import DefaultRouter
from .views import (
    QualityProcessViewSet, QualityDocumentViewSet,
    InternalAuditViewSet, NonConformityViewSet,
    ContinuousImprovementViewSet, QualityDashboardView,
)

router = DefaultRouter()
router.register('processes', QualityProcessViewSet, basename='quality-process')
router.register('documents', QualityDocumentViewSet, basename='quality-document')
router.register('audits', InternalAuditViewSet, basename='internal-audit')
router.register('nonconformities', NonConformityViewSet, basename='nonconformity')
router.register('improvements', ContinuousImprovementViewSet, basename='improvement')
router.register('dashboard', QualityDashboardView, basename='quality-dashboard')

urlpatterns = router.urls
