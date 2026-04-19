from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from apps.core.permissions import HasTenant
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


class QualityProcessViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
    serializer_class = QualityProcessSerializer

    def get_queryset(self):
        qs = QualityProcess.objects.for_tenant(
            self.request.tenant,
        ).select_related('owner', 'department')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class QualityDocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
    serializer_class = QualityDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = QualityDocument.objects.for_tenant(
            self.request.tenant,
        ).select_related('process')
        process_id = self.request.query_params.get('process')
        if process_id:
            qs = qs.filter(process_id=process_id)
        doc_type = self.request.query_params.get('type')
        if doc_type:
            qs = qs.filter(document_type=doc_type)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class InternalAuditViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]

    def get_queryset(self):
        qs = InternalAudit.objects.for_tenant(
            self.request.tenant,
        ).select_related('process', 'auditor').prefetch_related('findings')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        process_id = self.request.query_params.get('process')
        if process_id:
            qs = qs.filter(process_id=process_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return InternalAuditListSerializer
        return InternalAuditSerializer

    @action(detail=True, methods=['get', 'post'], url_path='findings')
    def findings(self, request, pk=None):
        audit = self.get_object()
        if request.method == 'GET':
            qs = audit.findings.all()
            return Response(AuditFindingSerializer(qs, many=True, context={'request': request}).data)

        serializer = AuditFindingSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(audit=audit, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NonConformityViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
    serializer_class = NonConformitySerializer

    def get_queryset(self):
        qs = NonConformity.objects.for_tenant(
            self.request.tenant,
        ).select_related('responsible', 'audit_finding')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        source = self.request.query_params.get('source')
        if source:
            qs = qs.filter(source=source)
        return qs

    def perform_update(self, serializer):
        instance = serializer.save()
        # Auto-stamp closed_at when status transitions to closed
        if instance.status == 'closed' and not instance.closed_at:
            instance.closed_at = timezone.now()
            instance.save(update_fields=['closed_at'])


class ContinuousImprovementViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
    serializer_class = ContinuousImprovementSerializer

    def get_queryset(self):
        qs = ContinuousImprovement.objects.for_tenant(
            self.request.tenant,
        ).select_related('process', 'proposed_by', 'responsible')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        priority = self.request.query_params.get('priority')
        if priority:
            qs = qs.filter(priority=priority)
        return qs


class QualityDashboardView(viewsets.ViewSet):
    permission_classes = [HasTenant]

    def list(self, request):
        tenant = request.tenant
        today = timezone.now().date()

        # Nonconformity counts by status
        nc_counts = (
            NonConformity.objects.for_tenant(tenant)
            .values('status')
            .annotate(n=Count('id'))
        )
        nc_by_status = {row['status']: row['n'] for row in nc_counts}

        # Audit counts by status
        audit_counts = (
            InternalAudit.objects.for_tenant(tenant)
            .values('status')
            .annotate(n=Count('id'))
        )
        audit_by_status = {row['status']: row['n'] for row in audit_counts}

        # Improvement counts by status
        imp_counts = (
            ContinuousImprovement.objects.for_tenant(tenant)
            .values('status')
            .annotate(n=Count('id'))
        )
        imp_by_status = {row['status']: row['n'] for row in imp_counts}

        # Documents whose review_date is in the next 30 days
        docs_pending = QualityProcess.objects.for_tenant(tenant).filter(
            review_date__lte=today,
            status='active',
        ).count()

        # Next 5 planned/in-progress audits
        upcoming_audits = (
            InternalAudit.objects.for_tenant(tenant)
            .filter(status__in=['planned', 'in_progress'])
            .select_related('process', 'auditor')
            .prefetch_related('findings')
            .order_by('planned_date')[:5]
        )

        # Overdue open nonconformities
        overdue_nc = (
            NonConformity.objects.for_tenant(tenant)
            .filter(
                due_date__lt=today,
                status__in=['open', 'in_progress', 'verification'],
            )
            .select_related('responsible', 'audit_finding')
            .order_by('due_date')
        )

        data = {
            'nonconformities_by_status': nc_by_status,
            'audits_by_status': audit_by_status,
            'improvements_by_status': imp_by_status,
            'documents_pending_review': docs_pending,
            'upcoming_audits': upcoming_audits,
            'overdue_nonconformities': overdue_nc,
        }
        serializer = QualityDashboardSerializer(data, context={'request': request})
        return Response(serializer.data)
