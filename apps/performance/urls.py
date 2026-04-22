from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    OKRPeriodViewSet, ObjectiveViewSet, KeyResultViewSet,
    KeyResultUpdateViewSet, KPIViewSet, KPIMeasurementViewSet,
    PerformanceDashboardView,
)

router = DefaultRouter()
router.register('periods', OKRPeriodViewSet, basename='okr-period')
router.register('objectives', ObjectiveViewSet, basename='objective')
router.register('key-results', KeyResultViewSet, basename='key-result')
router.register('kpis', KPIViewSet, basename='kpi')
router.register('dashboard', PerformanceDashboardView, basename='performance-dashboard')

# Nested: /periods/{period_pk}/objectives/{pk}/
_objective_detail = ObjectiveViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

# Nested: /objectives/{objective_pk}/key-results/{pk}/
_kr_detail = KeyResultViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

# Nested: /key-results/{kr_pk}/updates/{pk}/
_update_detail = KeyResultUpdateViewSet.as_view({
    'get': 'retrieve',
    'delete': 'destroy',
})

# Nested: /kpis/{kpi_pk}/measurements/{pk}/
_measurement_detail = KPIMeasurementViewSet.as_view({
    'get': 'retrieve',
    'delete': 'destroy',
})

urlpatterns = router.urls + [
    path(
        'periods/<uuid:period_pk>/objectives/<uuid:pk>/',
        _objective_detail,
        name='period-objective-detail',
    ),
    path(
        'objectives/<uuid:objective_pk>/key-results/<uuid:pk>/',
        _kr_detail,
        name='objective-kr-detail',
    ),
    path(
        'key-results/<uuid:kr_pk>/updates/<uuid:pk>/',
        _update_detail,
        name='kr-update-detail',
    ),
    path(
        'kpis/<uuid:kpi_pk>/measurements/<uuid:pk>/',
        _measurement_detail,
        name='kpi-measurement-detail',
    ),
]
