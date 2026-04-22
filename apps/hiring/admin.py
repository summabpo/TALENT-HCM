from django.contrib import admin
from .models import (
    HiringProcess, Candidate,
    OnboardingChecklist, OnboardingTask,
    EmployeeOnboarding, OnboardingTaskCompletion,
)


class TenantModelAdmin(admin.ModelAdmin):
    list_filter = ['tenant']


class CandidateInline(admin.TabularInline):
    model = Candidate
    extra = 0
    fields = ['full_name', 'email', 'status', 'employee']
    readonly_fields = ['employee']
    show_change_link = True


@admin.register(HiringProcess)
class HiringProcessAdmin(TenantModelAdmin):
    list_display = ['position_title', 'department', 'status', 'positions_count', 'hired_count', 'tenant']
    list_filter = ['status', 'tenant']
    search_fields = ['position_title']
    inlines = [CandidateInline]

    def hired_count(self, obj):
        return obj.hired_count
    hired_count.short_description = 'Contratados'


@admin.register(Candidate)
class CandidateAdmin(TenantModelAdmin):
    list_display = ['full_name', 'hiring_process', 'status', 'email', 'tenant']
    list_filter = ['status', 'tenant']
    search_fields = ['full_name', 'email']
    raw_id_fields = ['hiring_process', 'employee']


class OnboardingTaskInline(admin.TabularInline):
    model = OnboardingTask
    extra = 0
    fields = ['order', 'title', 'responsible_role', 'days_to_complete']
    ordering = ['order']


@admin.register(OnboardingChecklist)
class OnboardingChecklistAdmin(TenantModelAdmin):
    list_display = ['name', 'is_default', 'tenant']
    list_filter = ['is_default', 'tenant']
    inlines = [OnboardingTaskInline]


@admin.register(OnboardingTask)
class OnboardingTaskAdmin(TenantModelAdmin):
    list_display = ['title', 'checklist', 'order', 'days_to_complete', 'tenant']
    list_filter = ['tenant']
    search_fields = ['title', 'checklist__name']
    raw_id_fields = ['checklist']
    ordering = ['checklist', 'order']


class OnboardingTaskCompletionInline(admin.TabularInline):
    model = OnboardingTaskCompletion
    extra = 0
    fields = ['task', 'completed_by', 'completed_at', 'notes']
    readonly_fields = ['task', 'completed_at']


@admin.register(EmployeeOnboarding)
class EmployeeOnboardingAdmin(TenantModelAdmin):
    list_display = ['employee', 'checklist', 'start_date', 'status', 'progress_percentage', 'tenant']
    list_filter = ['status', 'tenant']
    search_fields = ['employee__first_name', 'employee__first_last_name']
    raw_id_fields = ['employee', 'checklist']
    readonly_fields = ['completed_at']
    inlines = [OnboardingTaskCompletionInline]

    def progress_percentage(self, obj):
        return f'{obj.progress_percentage}%'
    progress_percentage.short_description = 'Progreso'


@admin.register(OnboardingTaskCompletion)
class OnboardingTaskCompletionAdmin(TenantModelAdmin):
    list_display = ['task', 'onboarding', 'completed_by', 'completed_at', 'tenant']
    list_filter = ['tenant']
    raw_id_fields = ['onboarding', 'task']
    readonly_fields = ['completed_at']
