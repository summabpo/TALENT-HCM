from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    QualityProcessViewSet, QualityDocumentViewSet,
    InternalAuditViewSet, AuditFindingViewSet,
    NonConformityViewSet, ContinuousImprovementViewSet,
    QualityDashboardView,
)

router = DefaultRouter()
router.register('processes', QualityProcessViewSet, basename='quality-process')
router.register('documents', QualityDocumentViewSet, basename='quality-document')
router.register('audits', InternalAuditViewSet, basename='internal-audit')
router.register('nonconformities', NonConformityViewSet, basename='nonconformity')
router.register('improvements', ContinuousImprovementViewSet, basename='improvement')
router.register('dashboard', QualityDashboardView, basename='quality-dashboard')

# Nested: /processes/{process_pk}/documents/{pk}/
_document_detail = QualityDocumentViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})
_document_approve = QualityDocumentViewSet.as_view({'post': 'approve'})

# Nested: /audits/{audit_pk}/findings/{pk}/
_finding_detail = AuditFindingViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

urlpatterns = router.urls + [
    path(
        'processes/<uuid:process_pk>/documents/<uuid:pk>/',
        _document_detail,
        name='process-document-detail',
    ),
    path(
        'processes/<uuid:process_pk>/documents/<uuid:pk>/approve/',
        _document_approve,
        name='process-document-approve',
    ),
    path(
        'audits/<uuid:audit_pk>/findings/<uuid:pk>/',
        _finding_detail,
        name='audit-finding-detail',
    ),
]
