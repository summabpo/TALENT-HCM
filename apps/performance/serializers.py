from rest_framework import serializers
from apps.core.serializers import TenantSerializer
from .models import (
    OKRPeriod, Objective, KeyResult, KeyResultUpdate,
    KPI, KPIMeasurement,
)


class OKRPeriodSerializer(TenantSerializer):
    objective_count = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = OKRPeriod
        fields = [
            'id', 'name', 'start_date', 'end_date', 'is_active',
            'objective_count',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_objective_count(self, obj):
        return obj.objectives.count()


class KeyResultUpdateSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = KeyResultUpdate
        fields = [
            'id', 'key_result',
            'previous_value', 'new_value',
            'comment', 'updated_by',
            'tenant', 'created_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['key_result', 'previous_value']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super(TenantSerializer, self).create(validated_data)


class KeyResultSerializer(TenantSerializer):
    progress_percentage = serializers.FloatField(read_only=True)
    responsible_name = serializers.CharField(source='responsible.full_name', read_only=True)
    updates = KeyResultUpdateSerializer(many=True, read_only=True)

    class Meta(TenantSerializer.Meta):
        model = KeyResult
        fields = [
            'id', 'objective',
            'title', 'description',
            'metric_type', 'unit',
            'start_value', 'target_value', 'current_value',
            'weight', 'progress_percentage',
            'responsible', 'responsible_name',
            'updates',
            'tenant', 'created_at', 'updated_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['objective', 'current_value']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super(TenantSerializer, self).create(validated_data)


class KeyResultListSerializer(TenantSerializer):
    """Lightweight — excludes nested updates for list/tree views."""
    progress_percentage = serializers.FloatField(read_only=True)
    responsible_name = serializers.CharField(source='responsible.full_name', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = KeyResult
        fields = [
            'id', 'title', 'metric_type', 'unit',
            'start_value', 'target_value', 'current_value',
            'weight', 'progress_percentage',
            'responsible', 'responsible_name',
            'tenant', 'created_at', 'updated_at',
        ]


class ObjectiveSerializer(TenantSerializer):
    progress_percentage = serializers.FloatField(read_only=True)
    owner_name = serializers.CharField(source='owner.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    key_results = KeyResultListSerializer(many=True, read_only=True)
    children_count = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = Objective
        fields = [
            'id', 'period',
            'title', 'description',
            'level', 'status', 'weight',
            'department', 'department_name',
            'owner', 'owner_name',
            'parent', 'children_count',
            'progress_percentage',
            'key_results',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_children_count(self, obj):
        return obj.children.count()


class ObjectiveListSerializer(TenantSerializer):
    """Lightweight list view — no nested key_results."""
    progress_percentage = serializers.FloatField(read_only=True)
    owner_name = serializers.CharField(source='owner.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = Objective
        fields = [
            'id', 'period', 'title', 'level', 'status',
            'weight', 'progress_percentage',
            'department', 'department_name',
            'owner', 'owner_name',
            'parent',
            'tenant', 'created_at', 'updated_at',
        ]


class KPIMeasurementSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = KPIMeasurement
        fields = [
            'id', 'kpi',
            'period_label', 'period_date',
            'value', 'comment', 'recorded_by',
            'tenant', 'created_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['kpi']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super(TenantSerializer, self).create(validated_data)


class KPISerializer(TenantSerializer):
    owner_name = serializers.CharField(source='owner.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    quality_process_code = serializers.CharField(source='quality_process.code', read_only=True)
    latest_value = serializers.SerializerMethodField()
    measurements = KPIMeasurementSerializer(many=True, read_only=True)

    class Meta(TenantSerializer.Meta):
        model = KPI
        fields = [
            'id', 'name', 'description',
            'department', 'department_name',
            'owner', 'owner_name',
            'quality_process', 'quality_process_code',
            'metric_type', 'unit', 'target_value',
            'frequency', 'is_active',
            'latest_value', 'measurements',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_latest_value(self, obj):
        latest = obj.measurements.order_by('-period_date').first()
        return float(latest.value) if latest else None


class KPIListSerializer(TenantSerializer):
    owner_name = serializers.CharField(source='owner.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    latest_value = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = KPI
        fields = [
            'id', 'name', 'metric_type', 'unit',
            'target_value', 'frequency', 'is_active',
            'department', 'department_name',
            'owner', 'owner_name',
            'latest_value',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_latest_value(self, obj):
        latest = obj.measurements.order_by('-period_date').first()
        return float(latest.value) if latest else None


# ─── Dashboard ────────────────────────────────────────────────────────────────

class PerformanceDashboardSerializer(serializers.Serializer):
    active_period = OKRPeriodSerializer(allow_null=True)
    objectives_by_status = serializers.DictField(child=serializers.IntegerField())
    objectives_by_level = serializers.DictField(child=serializers.IntegerField())
    avg_progress_by_level = serializers.DictField(child=serializers.FloatField())
    active_kpis_count = serializers.IntegerField()
    kpis_on_target = serializers.IntegerField()
