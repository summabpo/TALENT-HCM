from rest_framework.routers import DefaultRouter
from .views import (
    OKRPeriodViewSet, ObjectiveViewSet, KeyResultViewSet,
    KPIViewSet, PerformanceDashboardView,
)

router = DefaultRouter()
router.register('periods', OKRPeriodViewSet, basename='okr-period')
router.register('objectives', ObjectiveViewSet, basename='objective')
router.register('key-results', KeyResultViewSet, basename='key-result')
router.register('kpis', KPIViewSet, basename='kpi')
router.register('dashboard', PerformanceDashboardView, basename='performance-dashboard')

urlpatterns = router.urls
