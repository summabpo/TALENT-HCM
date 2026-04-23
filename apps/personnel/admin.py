from django.contrib import admin
from .models import Department, Employee, Contract, EmployeeDocument, EmployeeHistory


class TenantModelAdmin(admin.ModelAdmin):
    list_filter = ['tenant']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant')


@admin.register(Department)
class DepartmentAdmin(TenantModelAdmin):
    list_display = ['name', 'parent', 'manager', 'tenant', 'is_active']
    list_filter = ['is_active', 'tenant']
    search_fields = ['name']
    raw_id_fields = ['manager', 'parent']


class ContractInline(admin.TabularInline):
    model = Contract
    extra = 0
    fields = ['contract_type', 'position', 'salary', 'start_date', 'end_date', 'is_current']
    readonly_fields = ['created_at']
    show_change_link = True


class DocumentInline(admin.TabularInline):
    model = EmployeeDocument
    extra = 0
    fields = ['document_type', 'title', 'expiration_date']
    show_change_link = True


@admin.register(Employee)
class EmployeeAdmin(TenantModelAdmin):
    list_display = [
        'full_name', 'document_number', 'document_type',
        'department', 'status', 'tenant',
    ]
    list_filter = ['status', 'tenant', 'department']
    search_fields = [
        'first_name', 'first_last_name',
        'second_name', 'second_last_name',
        'document_number', 'email',
    ]
    raw_id_fields = ['department', 'direct_manager']
    readonly_fields = ['global_employee_id', 'created_at', 'updated_at']
    inlines = [ContractInline, DocumentInline]
    fieldsets = (
        ('Identidad', {
            'fields': (
                'global_employee_id', 'tenant',
                'document_type', 'document_number',
                'first_name', 'second_name',
                'first_last_name', 'second_last_name',
            )
        }),
        ('Contacto', {
            'fields': ('email', 'personal_email', 'phone', 'cell_phone', 'address'),
        }),
        ('Datos personales', {
            'classes': ('collapse',),
            'fields': (
                'gender', 'weight', 'height', 'resume_format',
                'date_of_birth', 'marital_status',
                'blood_type', 'socioeconomic_stratum',
                'birth_city', 'birth_country',
                'residence_city', 'residence_country',
                'profession', 'education_level',
                'document_expedition_date', 'document_expedition_city',
            ),
        }),
        ('Dotación / Emergencia', {
            'classes': ('collapse',),
            'fields': (
                'photo',
                'uniform_pants', 'uniform_shirt', 'uniform_shoes',
                'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relationship',
            ),
        }),
        ('Organización', {
            'fields': ('department', 'direct_manager', 'employee_number', 'status', 'is_active'),
        }),
    )


@admin.register(Contract)
class ContractAdmin(TenantModelAdmin):
    list_display = [
        'employee', 'contract_type', 'position',
        'salary', 'start_date', 'is_current', 'tenant',
    ]
    list_filter = ['is_current', 'contract_status', 'tenant']
    search_fields = ['employee__first_name', 'employee__first_last_name']
    raw_id_fields = ['employee']


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(TenantModelAdmin):
    list_display = ['employee', 'document_type', 'title', 'expiration_date', 'tenant']
    list_filter = ['document_type', 'tenant']
    raw_id_fields = ['employee']


@admin.register(EmployeeHistory)
class EmployeeHistoryAdmin(TenantModelAdmin):
    list_display = ['employee', 'change_type', 'field_name', 'changed_by', 'created_at']
    list_filter = ['change_type', 'tenant']
    readonly_fields = [f.name for f in EmployeeHistory._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
