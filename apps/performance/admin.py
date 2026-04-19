from django.contrib import admin
from .models import (
    OKRPeriod, Objective, KeyResult, KeyResultUpdate,
    KPI, KPIMeasurement,
)


class TenantModelAdmin(admin.ModelAdmin):
    list_filter = ['tenant']


class KeyResultInline(admin.TabularInline):
    model = KeyResult
    extra = 0
    fields = ['title', 'metric_type', 'start_value', 'target_value', 'current_value', 'weight']
    readonly_fields = ['current_value']
    show_change_link = True


@admin.register(OKRPeriod)
class OKRPeriodAdmin(TenantModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'is_active', 'tenant']
    list_filter = ['is_active', 'tenant']


@admin.register(Objective)
class ObjectiveAdmin(TenantModelAdmin):
    list_display = ['title', 'period', 'level', 'status', 'weight', 'owner', 'tenant']
    list_filter = ['level', 'status', 'tenant']
    search_fields = ['title']
    raw_id_fields = ['period', 'department', 'owner', 'parent']
    inlines = [KeyResultInline]


class KeyResultUpdateInline(admin.TabularInline):
    model = KeyResultUpdate
    extra = 0
    fields = ['previous_value', 'new_value', 'comment', 'updated_by', 'created_at']
    readonly_fields = ['created_at']


@admin.register(KeyResult)
class KeyResultAdmin(TenantModelAdmin):
    list_display = ['title', 'objective', 'metric_type', 'current_value', 'target_value', 'tenant']
    list_filter = ['metric_type', 'tenant']
    search_fields = ['title']
    raw_id_fields = ['objective', 'responsible']
    readonly_fields = ['current_value']
    inlines = [KeyResultUpdateInline]


class KPIMeasurementInline(admin.TabularInline):
    model = KPIMeasurement
    extra = 0
    fields = ['period_label', 'period_date', 'value', 'recorded_by']
    ordering = ['-period_date']


@admin.register(KPI)
class KPIAdmin(TenantModelAdmin):
    list_display = ['name', 'metric_type', 'target_value', 'frequency', 'is_active', 'tenant']
    list_filter = ['metric_type', 'frequency', 'is_active', 'tenant']
    search_fields = ['name']
    raw_id_fields = ['department', 'owner', 'quality_process']
    inlines = [KPIMeasurementInline]
