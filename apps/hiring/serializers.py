from rest_framework import serializers
from apps.core.serializers import TenantSerializer
from .models import (
    HiringProcess, Candidate,
    OnboardingChecklist, OnboardingTask,
    EmployeeOnboarding, OnboardingTaskCompletion,
)


# ─── Hiring Process ───────────────────────────────────────────────────────────

class HiringProcessSerializer(TenantSerializer):
    hired_count = serializers.IntegerField(read_only=True)
    candidate_count = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = HiringProcess
        fields = [
            'id', 'position_title', 'department', 'department_name',
            'requested_by', 'status', 'positions_count', 'notes',
            'hired_count', 'candidate_count',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_candidate_count(self, obj):
        return obj.candidates.count()


# ─── Candidate ────────────────────────────────────────────────────────────────

class CandidateSerializer(TenantSerializer):
    hiring_process_title = serializers.CharField(
        source='hiring_process.position_title', read_only=True,
    )
    employee_id = serializers.UUIDField(source='employee.id', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = Candidate
        fields = [
            'id', 'hiring_process', 'hiring_process_title',
            'full_name', 'email', 'phone', 'resume',
            'status', 'notes', 'employee_id',
            'tenant', 'created_at', 'updated_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['hiring_process', 'employee_id']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super(TenantSerializer, self).create(validated_data)


class HireActionSerializer(serializers.Serializer):
    """Input for POST /candidates/{id}/hire/"""
    document_type = serializers.IntegerField(
        help_text='ID of the DocumentType catalog entry',
    )
    document_number = serializers.IntegerField()


# ─── Onboarding Checklist ─────────────────────────────────────────────────────

class OnboardingTaskSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = OnboardingTask
        fields = [
            'id', 'checklist', 'title', 'description',
            'responsible_role', 'order', 'days_to_complete',
            'tenant', 'created_at', 'updated_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['checklist']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super(TenantSerializer, self).create(validated_data)


class OnboardingChecklistSerializer(TenantSerializer):
    tasks = OnboardingTaskSerializer(many=True, read_only=True)
    task_count = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = OnboardingChecklist
        fields = [
            'id', 'name', 'description', 'is_default',
            'task_count', 'tasks',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_task_count(self, obj):
        return obj.tasks.count()


# ─── Employee Onboarding ──────────────────────────────────────────────────────

class OnboardingTaskCompletionSerializer(serializers.ModelSerializer):
    task_title = serializers.CharField(source='task.title', read_only=True)
    task_order = serializers.IntegerField(source='task.order', read_only=True)
    responsible_role = serializers.CharField(source='task.responsible_role', read_only=True)
    days_to_complete = serializers.IntegerField(source='task.days_to_complete', read_only=True)
    is_complete = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingTaskCompletion
        fields = [
            'id', 'task', 'task_title', 'task_order',
            'responsible_role', 'days_to_complete',
            'is_complete', 'completed_by', 'completed_at', 'notes',
        ]
        read_only_fields = ['id', 'task', 'task_title', 'task_order',
                            'responsible_role', 'days_to_complete', 'is_complete']

    def get_is_complete(self, obj):
        return obj.completed_at is not None


class CompleteTaskSerializer(serializers.Serializer):
    """Input for PATCH /onboardings/{id}/tasks/{task_id}/complete/"""
    completed_by = serializers.CharField(max_length=255)
    notes = serializers.CharField(allow_blank=True, default='')


class EmployeeOnboardingSerializer(TenantSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    checklist_name = serializers.CharField(source='checklist.name', read_only=True)
    progress_percentage = serializers.IntegerField(read_only=True)
    completions = OnboardingTaskCompletionSerializer(many=True, read_only=True)

    class Meta(TenantSerializer.Meta):
        model = EmployeeOnboarding
        fields = [
            'id', 'employee', 'employee_name',
            'checklist', 'checklist_name',
            'start_date', 'completed_at', 'status',
            'progress_percentage', 'completions',
            'tenant', 'created_at', 'updated_at',
        ]
