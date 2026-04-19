from rest_framework import serializers
from apps.core.serializers import TenantSerializer
from .models import (
    QualityProcess, QualityDocument,
    InternalAudit, AuditFinding,
    NonConformity, ContinuousImprovement,
)


class QualityProcessSerializer(TenantSerializer):
    owner_name = serializers.CharField(source='owner.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    document_count = serializers.SerializerMethodField()
    open_nonconformity_count = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = QualityProcess
        fields = [
            'id', 'code', 'name', 'description',
            'owner', 'owner_name',
            'department', 'department_name',
            'version', 'status',
            'effective_date', 'review_date',
            'document_count', 'open_nonconformity_count',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_document_count(self, obj):
        return obj.documents.exclude(status='obsolete').count()

    def get_open_nonconformity_count(self, obj):
        # Via audit findings linked to this process's audits
        return NonConformity.objects.filter(
            tenant=obj.tenant,
            audit_finding__audit__process=obj,
        ).exclude(status='closed').count()


class QualityDocumentSerializer(TenantSerializer):
    process_code = serializers.CharField(source='process.code', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = QualityDocument
        fields = [
            'id', 'process', 'process_code',
            'code', 'title', 'document_type', 'version',
            'file', 'status',
            'approved_by', 'approved_at', 'effective_date',
            'tenant', 'created_at', 'updated_at',
        ]


class AuditFindingSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = AuditFinding
        fields = [
            'id', 'audit',
            'finding_type', 'clause',
            'description', 'evidence',
            'tenant', 'created_at', 'updated_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['audit']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super(TenantSerializer, self).create(validated_data)


class InternalAuditSerializer(TenantSerializer):
    auditor_name = serializers.CharField(source='auditor.full_name', read_only=True)
    process_code = serializers.CharField(source='process.code', read_only=True)
    findings = AuditFindingSerializer(many=True, read_only=True)
    finding_count = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = InternalAudit
        fields = [
            'id', 'code',
            'process', 'process_code',
            'auditor', 'auditor_name',
            'planned_date', 'executed_date',
            'scope', 'status', 'conclusions',
            'finding_count', 'findings',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_finding_count(self, obj):
        return obj.findings.count()


class InternalAuditListSerializer(TenantSerializer):
    """Lightweight — excludes nested findings for list views."""
    auditor_name = serializers.CharField(source='auditor.full_name', read_only=True)
    process_code = serializers.CharField(source='process.code', read_only=True)
    finding_count = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = InternalAudit
        fields = [
            'id', 'code',
            'process', 'process_code',
            'auditor', 'auditor_name',
            'planned_date', 'executed_date',
            'status', 'finding_count',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_finding_count(self, obj):
        return obj.findings.count()


class NonConformitySerializer(TenantSerializer):
    responsible_name = serializers.CharField(source='responsible.full_name', read_only=True)
    audit_finding_type = serializers.CharField(
        source='audit_finding.get_finding_type_display', read_only=True,
    )

    class Meta(TenantSerializer.Meta):
        model = NonConformity
        fields = [
            'id', 'code', 'source',
            'audit_finding', 'audit_finding_type',
            'description', 'root_cause',
            'immediate_action', 'corrective_action', 'preventive_action',
            'responsible', 'responsible_name',
            'due_date', 'status',
            'closed_at', 'effectiveness_verified',
            'tenant', 'created_at', 'updated_at',
        ]


class ContinuousImprovementSerializer(TenantSerializer):
    proposed_by_name = serializers.CharField(source='proposed_by.full_name', read_only=True)
    responsible_name = serializers.CharField(source='responsible.full_name', read_only=True)
    process_code = serializers.CharField(source='process.code', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = ContinuousImprovement
        fields = [
            'id', 'code', 'title', 'description',
            'process', 'process_code',
            'proposed_by', 'proposed_by_name',
            'responsible', 'responsible_name',
            'expected_benefit', 'status', 'priority',
            'due_date', 'result',
            'tenant', 'created_at', 'updated_at',
        ]


# ─── Dashboard ────────────────────────────────────────────────────────────────

class QualityDashboardSerializer(serializers.Serializer):
    nonconformities_by_status = serializers.DictField(child=serializers.IntegerField())
    audits_by_status = serializers.DictField(child=serializers.IntegerField())
    improvements_by_status = serializers.DictField(child=serializers.IntegerField())
    documents_pending_review = serializers.IntegerField()
    upcoming_audits = InternalAuditListSerializer(many=True)
    overdue_nonconformities = NonConformitySerializer(many=True)
