from rest_framework import serializers
from apps.catalogs.models import City, Country, DocumentType, Profession
from apps.core.serializers import TenantSerializer
from .models import Department, Employee, Contract, EmployeeDocument, EmployeeHistory


class NullablePKRelatedField(serializers.PrimaryKeyRelatedField):
    """Accepts empty string from multipart form for optional FKs."""

    def to_internal_value(self, data):
        if data in (None, '', 'null', 'None'):
            if not self.allow_null:
                self.fail('invalid')
            return None
        return super().to_internal_value(data)


class DocumentTypeNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentType
        fields = ['id', 'name', 'code']


class ProfessionNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profession
        fields = ['id', 'name']


class CountryNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'name']


class CityNestedSerializer(serializers.ModelSerializer):
    country_id = serializers.IntegerField(source='state_province.country_id', read_only=True)

    class Meta:
        model = City
        fields = ['id', 'name', 'country_id']


# ─── Department ──────────────────────────────────────────────────────────────

class DepartmentSerializer(TenantSerializer):
    children_count = serializers.SerializerMethodField()

    class Meta(TenantSerializer.Meta):
        model = Department
        fields = [
            'id', 'name', 'parent', 'manager',
            'is_active', 'children_count',
            'tenant', 'created_at', 'updated_at',
        ]

    def get_children_count(self, obj):
        return obj.children.filter(is_active=True).count()


class DepartmentTreeSerializer(serializers.Serializer):
    """Recursive org-tree — read-only."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    manager = serializers.UUIDField(allow_null=True)
    children = serializers.SerializerMethodField()

    def get_children(self, obj):
        kids = obj.children.filter(is_active=True).select_related('manager')
        return DepartmentTreeSerializer(kids, many=True).data


# ─── Employee ─────────────────────────────────────────────────────────────────

class EmployeeListSerializer(TenantSerializer):
    """Lightweight serializer for list views."""
    full_name = serializers.CharField(read_only=True)
    document_type_code = serializers.CharField(source='document_type.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = Employee
        fields = [
            'id', 'global_employee_id',
            'full_name', 'employee_number',
            'document_type', 'document_type_code', 'document_number',
            'email', 'status', 'is_active',
            'department', 'department_name',
            'created_at',
        ]


class EmployeeDetailSerializer(TenantSerializer):
    """Full employee detail including computed fields."""
    full_name = serializers.CharField(read_only=True)
    document_type = DocumentTypeNestedSerializer(read_only=True)
    profession = ProfessionNestedSerializer(read_only=True)
    birth_country = CountryNestedSerializer(read_only=True)
    birth_city = CityNestedSerializer(read_only=True)
    residence_country = CountryNestedSerializer(read_only=True)
    residence_city = CityNestedSerializer(read_only=True)
    document_expedition_city = CityNestedSerializer(read_only=True)

    class Meta(TenantSerializer.Meta):
        model = Employee
        fields = [
            'id', 'global_employee_id',
            # Identity
            'document_type', 'document_number',
            'first_name', 'second_name', 'first_last_name', 'second_last_name',
            'full_name',
            # Contact
            'email', 'personal_email', 'phone', 'cell_phone', 'address',
            # Personal
            'gender', 'date_of_birth',
            'birth_city', 'birth_country',
            'residence_city', 'residence_country',
            'marital_status', 'blood_type', 'socioeconomic_stratum',
            'weight', 'height', 'resume_format',
            # Academic
            'profession', 'education_level',
            # ID doc
            'document_expedition_date', 'document_expedition_city',
            # Uniform
            'uniform_pants', 'uniform_shirt', 'uniform_shoes',
            # Military
            'num_libreta_militar',
            # Emergency
            'emergency_contact_name', 'emergency_contact_phone',
            'emergency_contact_relationship',
            # Photo & CV
            'photo', 'resume_file',
            # Org
            'department', 'direct_manager', 'employee_number',
            # Status
            'status', 'is_active',
            # Meta
            'tenant', 'created_at', 'updated_at',
        ]


class EmployeeWriteSerializer(TenantSerializer):
    """Used for POST/PATCH — no computed read-only fields."""

    birth_country = NullablePKRelatedField(
        queryset=Country.objects.filter(is_active=True), allow_null=True, required=False,
    )
    birth_city = NullablePKRelatedField(
        queryset=City.objects.filter(is_active=True).select_related('state_province'),
        allow_null=True, required=False,
    )
    residence_country = NullablePKRelatedField(
        queryset=Country.objects.filter(is_active=True), allow_null=True, required=False,
    )
    residence_city = NullablePKRelatedField(
        queryset=City.objects.filter(is_active=True).select_related('state_province'),
        allow_null=True, required=False,
    )
    document_expedition_city = NullablePKRelatedField(
        queryset=City.objects.filter(is_active=True).select_related('state_province'),
        allow_null=True, required=False,
    )
    profession = NullablePKRelatedField(
        queryset=Profession.objects.all(), allow_null=True, required=False,
    )

    class Meta(TenantSerializer.Meta):
        model = Employee
        fields = [
            'id',
            'document_type', 'document_number',
            'first_name', 'second_name', 'first_last_name', 'second_last_name',
            'email', 'personal_email', 'phone', 'cell_phone', 'address',
            'gender', 'date_of_birth',
            'birth_city', 'birth_country',
            'residence_city', 'residence_country',
            'marital_status', 'blood_type', 'socioeconomic_stratum',
            'weight', 'height', 'resume_format',
            'profession', 'education_level',
            'document_expedition_date', 'document_expedition_city',
            'uniform_pants', 'uniform_shirt', 'uniform_shoes',
            'num_libreta_militar',
            'emergency_contact_name', 'emergency_contact_phone',
            'emergency_contact_relationship',
            'photo', 'resume_file',
            'department', 'direct_manager', 'employee_number',
            'status', 'is_active',
            'tenant', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        # CharField en modelo sin null=True: el cliente no debe enviar null (usa '').
        if 'socioeconomic_stratum' in attrs and attrs['socioeconomic_stratum'] is None:
            attrs['socioeconomic_stratum'] = ''
        for key in ('weight', 'height', 'resume_format'):
            if key in attrs and attrs[key] is None:
                attrs[key] = ''

        resume_f = attrs.get('resume_file')
        if resume_f:
            if resume_f.size > 3 * 1024 * 1024:
                raise serializers.ValidationError(
                    {'resume_file': 'El archivo no puede superar 3 MB.'}
                )
            if not (getattr(resume_f, 'name', '') or '').lower().endswith('.pdf'):
                raise serializers.ValidationError(
                    {'resume_file': 'Solo se acepta un archivo PDF.'}
                )
            attrs['resume_format'] = Employee.ResumeFormat.PDF

        tenant = self.context['request'].tenant
        doc_type = attrs.get('document_type', getattr(self.instance, 'document_type', None))
        doc_num = attrs.get('document_number', getattr(self.instance, 'document_number', None))
        qs = Employee.objects.filter(tenant=tenant, document_type=doc_type, document_number=doc_num)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'document_number': 'Ya existe un empleado con este documento en la empresa.'}
            )
        return attrs

    def update(self, instance, validated_data):
        # Tag the instance so the pre_save signal can record who changed it
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            instance._changed_by = str(request.user)
        return super().update(instance, validated_data)


# ─── Contract ─────────────────────────────────────────────────────────────────

class ContractSerializer(TenantSerializer):
    position_name = serializers.CharField(source='position.name', read_only=True)
    contract_type_name = serializers.CharField(source='contract_type.name', read_only=True)

    class Meta(TenantSerializer.Meta):
        model = Contract
        fields = [
            'id',
            # Basics
            'employee',
            'contract_type', 'contract_type_name',
            'contract_template',
            'start_date', 'end_date',
            'hiring_city',
            # Compensation
            'payroll_type', 'salary', 'salary_type', 'salary_mode',
            'transport_allowance', 'payment_method', 'work_schedule',
            # Banking
            'bank', 'bank_account_number', 'bank_account_type',
            # Position
            'position', 'position_name',
            'cost_center', 'sub_cost_center',
            'work_location', 'work_center',
            # Social security
            'eps', 'afp', 'ccf', 'severance_fund',
            # PILA
            'contributor_type', 'contributor_subtype',
            # Tax
            'withholding_method', 'withholding_percentage',
            'housing_deductible', 'health_deductible', 'medical_deductible',
            'dependents',
            # Status
            'contract_status', 'settlement_status', 'social_security_status',
            'is_pensioner', 'pension_risk', 'is_current',
            'legacy_contract_id',
            # Document
            'document', 'notes',
            # Meta
            'tenant', 'created_at', 'updated_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['employee']
        extra_kwargs = {
            # Aceptar null en JSON; convertir a '' en validate() (el modelo no usa null=True en estos textos).
            'payment_method': {'allow_null': True},
            'is_pensioner': {'allow_null': True},
            'legacy_contract_id': {'allow_null': True},
            'work_schedule': {'allow_null': True},
            'withholding_method': {'allow_null': True},
            'settlement_status': {'allow_null': True},
            'social_security_status': {'allow_null': True},
            'notes': {'allow_null': True},
            'bank_account_number': {'allow_null': True},
            'bank_account_type': {'allow_null': True},
        }

    def validate(self, attrs):
        str_fields_to_empty = (
            'payment_method',
            'is_pensioner',
            'legacy_contract_id',
            'work_schedule',
            'withholding_method',
            'settlement_status',
            'social_security_status',
            'notes',
            'bank_account_number',
            'bank_account_type',
        )
        for key in str_fields_to_empty:
            if key in attrs and attrs[key] is None:
                attrs[key] = ''
        return attrs

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        # employee is injected by the view, not the serializer
        return super(TenantSerializer, self).create(validated_data)


# ─── Employee Document ────────────────────────────────────────────────────────

class EmployeeDocumentSerializer(TenantSerializer):
    class Meta(TenantSerializer.Meta):
        model = EmployeeDocument
        fields = [
            'id', 'employee',
            'document_type', 'title', 'file',
            'expiration_date', 'notes',
            'tenant', 'created_at', 'updated_at',
        ]
        read_only_fields = TenantSerializer.Meta.read_only_fields + ['employee']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super(TenantSerializer, self).create(validated_data)


# ─── Employee History ─────────────────────────────────────────────────────────

class EmployeeHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeHistory
        fields = [
            'id', 'change_type', 'field_name',
            'old_value', 'new_value',
            'changed_by', 'reason', 'created_at',
        ]
        read_only_fields = fields
