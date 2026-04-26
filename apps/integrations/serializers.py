from rest_framework import serializers
from apps.integrations.models import NomiwebConfig, SyncLog


class NomiwebConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = NomiwebConfig
        fields = [
            'id', 'tenant', 'nomiweb_empresa_id', 'sync_enabled',
            'last_sync_at', 'last_sync_status', 'sync_interval_minutes',
        ]
        read_only_fields = ['last_sync_at', 'last_sync_status']


class SyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncLog
        fields = [
            'id', 'tenant', 'direction', 'model_name', 'nomiweb_id',
            'hcm_id', 'status', 'action', 'error_message', 'created_at',
        ]
