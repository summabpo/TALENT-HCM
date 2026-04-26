from django.contrib import admin
from apps.integrations.models import NomiwebConfig, SyncLog


@admin.register(NomiwebConfig)
class NomiwebConfigAdmin(admin.ModelAdmin):
    list_display = [
        'tenant', 'nomiweb_empresa_id', 'sync_enabled',
        'last_sync_at', 'last_sync_status',
    ]
    list_filter = ['sync_enabled', 'last_sync_status']
    search_fields = ['tenant__name']
    readonly_fields = ['last_sync_at', 'last_sync_status', 'created_at', 'updated_at']


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = [
        'created_at', 'tenant', 'direction', 'model_name',
        'nomiweb_id', 'status', 'action',
    ]
    list_filter = ['status', 'direction', 'model_name']
    search_fields = ['nomiweb_id', 'hcm_id', 'error_message']
    readonly_fields = [
        'id', 'tenant', 'direction', 'model_name', 'nomiweb_id',
        'hcm_id', 'status', 'action', 'error_message', 'created_at',
    ]
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False
