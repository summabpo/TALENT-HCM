from django.db.models import Count
from django.utils import timezone
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from apps.core.permissions import HasTenant, HasModule
from .models import (
    QualityProcess, QualityDocument,
    InternalAudit, AuditFinding,
    NonConformity, ContinuousImprovement,
)
from .serializers import (
    QualityProcessSerializer, QualityDocumentSerializer,
    InternalAuditSerializer, InternalAuditListSerializer, AuditFindingSerializer,
    NonConformitySerializer, ContinuousImprovementSerializer,
    QualityDashboardSerializer,
)


class QualityModulePermission(HasModule):
    module = 'quality'


QUALITY_PERMISSIONS = [HasTenant, QualityModulePermission]


class QualityProcessViewSet(viewsets.ModelViewSet):
    permission_classes = QUALITY_PERMISSIONS
    serializer_class = QualityProcessSerializer

    def get_queryset(self):
        qs = QualityProcess.objects.for_tenant(
            self.request.tenant,
        ).select_related('owner', 'department')
        if status_filter := self.request.query_params.get('status'):
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['get', 'post'], url_path='documents')
    def documents(self, request, pk=None):
        """List or create documents under a specific process."""
        process = self.get_object()
        if request.method == 'GET':
            qs = QualityDocument.objects.for_tenant(request.tenant).filter(
                process=process,
            ).select_related('process')
            if status_filter := request.query_params.get('status'):
                qs = qs.filter(status=status_filter)
            return Response(
                QualityDocumentSerializer(qs, many=True, context={'request': request}).data
            )
        serializer = QualityDocumentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(process=process, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QualityDocumentViewSet(viewsets.ModelViewSet):
    permission_classes = QUALITY_PERMISSIONS
    serializer_class = QualityDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = QualityDocument.objects.for_tenant(
            self.request.tenant,
        ).select_related('process')
        # Scope to process when accessed via nested URL
        if process_pk := self.kwargs.get('process_pk'):
            qs = qs.filter(process_id=process_pk)
        if status_filter := self.request.query_params.get('status'):
            qs = qs.filter(status=status_filter)
        if doc_type := self.request.query_params.get('type'):
            qs = qs.filter(document_type=doc_type)
        return qs

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None, **kwargs):
        """
        Approve a document: sets status=approved, approved_by, approved_at.
        POST /api/v1/quality/processes/{process_pk}/documents/{pk}/approve/
        """
        doc = self.get_object()
        if doc.status == 'approved':
            return Response(
                {'detail': 'Document is already approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doc.status = 'approved'
        doc.approved_by = str(request.user)
        doc.approved_at = timezone.now()
        doc.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        return Response(QualityDocumentSerializer(doc, context={'request': request}).data)


class AuditFindingViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Detail CRUD for findings scoped under an audit."""
    permission_classes = QUALITY_PERMISSIONS
    serializer_class = AuditFindingSerializer

    def get_queryset(self):
        qs = AuditFinding.objects.for_tenant(
            self.request.tenant,
        ).select_related('audit')
        if audit_pk := self.kwargs.get('audit_pk'):
            qs = qs.filter(audit_id=audit_pk)
        return qs


class InternalAuditViewSet(viewsets.ModelViewSet):
    permission_classes = QUALITY_PERMISSIONS

    def get_queryset(self):
        qs = InternalAudit.objects.for_tenant(
            self.request.tenant,
        ).select_related('process', 'auditor').prefetch_related('findings')
        if status_filter := self.request.query_params.get('status'):
            qs = qs.filter(status=status_filter)
        if process_id := self.request.query_params.get('process'):
            qs = qs.filter(process_id=process_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return InternalAuditListSerializer
        return InternalAuditSerializer

    @action(detail=True, methods=['get', 'post'], url_path='findings')
    def findings(self, request, pk=None):
        """List or create findings under a specific audit."""
        audit = self.get_object()
        if request.method == 'GET':
            qs = audit.findings.all()
            if finding_type := request.query_params.get('finding_type'):
                qs = qs.filter(finding_type=finding_type)
            return Response(
                AuditFindingSerializer(qs, many=True, context={'request': request}).data
            )
        serializer = AuditFindingSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(audit=audit, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NonConformityViewSet(viewsets.ModelViewSet):
    permission_classes = QUALITY_PERMISSIONS
    serializer_class = NonConformitySerializer

    def get_queryset(self):
        qs = NonConformity.objects.for_tenant(
            self.request.tenant,
        ).select_related('responsible', 'audit_finding')
        if status_filter := self.request.query_params.get('status'):
            qs = qs.filter(status=status_filter)
        if source := self.request.query_params.get('source'):
            qs = qs.filter(source=source)
        return qs

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == 'closed' and not instance.closed_at:
            instance.closed_at = timezone.now()
            instance.save(update_fields=['closed_at'])

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        """
        Close a nonconformity: sets status=closed, closed_at=now().
        POST /api/v1/quality/nonconformities/{pk}/close/
        """
        nc = self.get_object()
        if nc.status == 'closed':
            return Response(
                {'detail': 'Nonconformity is already closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nc.status = 'closed'
        nc.closed_at = timezone.now()
        nc.effectiveness_verified = request.data.get('effectiveness_verified', False)
        nc.save(update_fields=['status', 'closed_at', 'effectiveness_verified', 'updated_at'])
        return Response(NonConformitySerializer(nc, context={'request': request}).data)


class ContinuousImprovementViewSet(viewsets.ModelViewSet):
    permission_classes = QUALITY_PERMISSIONS
    serializer_class = ContinuousImprovementSerializer

    def get_queryset(self):
        qs = ContinuousImprovement.objects.for_tenant(
            self.request.tenant,
        ).select_related('process', 'proposed_by', 'responsible')
        if status_filter := self.request.query_params.get('status'):
            qs = qs.filter(status=status_filter)
        if priority := self.request.query_params.get('priority'):
            qs = qs.filter(priority=priority)
        return qs


class QualityDashboardView(viewsets.ViewSet):
    permission_classes = QUALITY_PERMISSIONS

    def list(self, request):
        tenant = request.tenant
        today = timezone.now().date()

        nc_by_status = {
            row['status']: row['n']
            for row in NonConformity.objects.for_tenant(tenant)
            .values('status').annotate(n=Count('id'))
        }
        audit_by_status = {
            row['status']: row['n']
            for row in InternalAudit.objects.for_tenant(tenant)
            .values('status').annotate(n=Count('id'))
        }
        imp_by_status = {
            row['status']: row['n']
            for row in ContinuousImprovement.objects.for_tenant(tenant)
            .values('status').annotate(n=Count('id'))
        }
        docs_pending = QualityProcess.objects.for_tenant(tenant).filter(
            review_date__lte=today, status='active',
        ).count()
        upcoming_audits = (
            InternalAudit.objects.for_tenant(tenant)
            .filter(status__in=['planned', 'in_progress'])
            .select_related('process', 'auditor')
            .prefetch_related('findings')
            .order_by('planned_date')[:5]
        )
        overdue_nc = (
            NonConformity.objects.for_tenant(tenant)
            .filter(due_date__lt=today, status__in=['open', 'in_progress', 'verification'])
            .select_related('responsible', 'audit_finding')
            .order_by('due_date')
        )

        serializer = QualityDashboardSerializer({
            'nonconformities_by_status': nc_by_status,
            'audits_by_status': audit_by_status,
            'improvements_by_status': imp_by_status,
            'documents_pending_review': docs_pending,
            'upcoming_audits': upcoming_audits,
            'overdue_nonconformities': overdue_nc,
        }, context={'request': request})
        return Response(serializer.data)
