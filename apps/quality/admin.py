from django.contrib import admin
from .models import (
    QualityProcess, QualityDocument,
    InternalAudit, AuditFinding,
    NonConformity, ContinuousImprovement,
)


class TenantModelAdmin(admin.ModelAdmin):
    list_filter = ['tenant']


class QualityDocumentInline(admin.TabularInline):
    model = QualityDocument
    extra = 0
    fields = ['code', 'title', 'document_type', 'version', 'status']
    show_change_link = True


@admin.register(QualityProcess)
class QualityProcessAdmin(TenantModelAdmin):
    list_display = ['code', 'name', 'version', 'status', 'owner', 'review_date', 'tenant']
    list_filter = ['status', 'tenant']
    search_fields = ['code', 'name']
    raw_id_fields = ['owner', 'department']
    inlines = [QualityDocumentInline]


@admin.register(QualityDocument)
class QualityDocumentAdmin(TenantModelAdmin):
    list_display = ['code', 'title', 'document_type', 'version', 'status', 'effective_date', 'tenant']
    list_filter = ['document_type', 'status', 'tenant']
    search_fields = ['code', 'title']
    raw_id_fields = ['process']


class AuditFindingInline(admin.TabularInline):
    model = AuditFinding
    extra = 0
    fields = ['finding_type', 'clause', 'description']
    show_change_link = True


@admin.register(InternalAudit)
class InternalAuditAdmin(TenantModelAdmin):
    list_display = ['code', 'process', 'auditor', 'planned_date', 'status', 'tenant']
    list_filter = ['status', 'tenant']
    search_fields = ['code']
    raw_id_fields = ['process', 'auditor']
    inlines = [AuditFindingInline]


@admin.register(AuditFinding)
class AuditFindingAdmin(TenantModelAdmin):
    list_display = ['audit', 'finding_type', 'clause', 'tenant']
    list_filter = ['finding_type', 'tenant']
    raw_id_fields = ['audit']


@admin.register(NonConformity)
class NonConformityAdmin(TenantModelAdmin):
    list_display = ['code', 'source', 'status', 'responsible', 'due_date', 'tenant']
    list_filter = ['status', 'source', 'tenant']
    search_fields = ['code', 'description']
    raw_id_fields = ['responsible', 'audit_finding']
    readonly_fields = ['closed_at']


@admin.register(ContinuousImprovement)
class ContinuousImprovementAdmin(TenantModelAdmin):
    list_display = ['code', 'title', 'priority', 'status', 'responsible', 'due_date', 'tenant']
    list_filter = ['status', 'priority', 'tenant']
    search_fields = ['code', 'title']
    raw_id_fields = ['process', 'proposed_by', 'responsible']
