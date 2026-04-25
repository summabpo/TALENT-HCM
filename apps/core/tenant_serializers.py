import re

from rest_framework import serializers

from apps.catalogs.models import Bank, City, Country, SocialSecurityEntity

from .models import Tenant, TenantModules


def _colombia_nit_format_ok(value: str) -> bool:
    """
    NIT colombiano: al menos 8 cifras; se permiten guiones. Opcional: dígito de verificación.
    Formato común: 800123456-1 (base + guion + verificación) o 10–11 cifras seguidas.
    """
    s = re.sub(r'[\s.]', '', (value or '').strip())
    if not s:
        return True
    digits = re.sub(r'[^0-9-]', '', s)
    if not digits:
        return False
    compact = digits.replace('-', '')
    if not compact.isdigit():
        return False
    if len(compact) < 8 or len(compact) > 11:
        return False
    return True


class CountryNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'name', 'iso_code']


class CityNestedSerializer(serializers.ModelSerializer):
    country_id = serializers.IntegerField(source='state_province.country_id', read_only=True)

    class Meta:
        model = City
        fields = ['id', 'name', 'code', 'state_province', 'country_id']


class ArlNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialSecurityEntity
        fields = ['id', 'code', 'nit', 'name', 'entity_type']


class BankNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bank
        fields = ['id', 'name', 'code']


class TenantModulesAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantModules
        fields = [
            'hiring', 'personnel', 'quality', 'performance', 'evaluations',
            'portal', 'surveys', 'orgchart',
        ]


class TenantAdminSerializer(serializers.ModelSerializer):
    """Staff-only CRUD for tenants (platform administration)."""
    modules = TenantModulesAdminSerializer(required=False, write_only=True)
    module_count = serializers.SerializerMethodField(read_only=True)
    clear_logo = serializers.BooleanField(required=False, write_only=True, default=False)
    clear_signature = serializers.BooleanField(required=False, write_only=True, default=False)

    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'slug', 'is_active', 'created_at',
            'document_type', 'document_number', 'legal_representative', 'phone',
            'arl', 'country', 'address', 'city', 'email', 'nit',
            'logo', 'signature',
            'clear_logo', 'clear_signature',
            'certification_title', 'website', 'language',
            'modules', 'module_count',
            # NIT / Identificación
            'dv', 'tipo_persona', 'naturaleza_juridica',
            # Representante legal detalle
            'tipo_doc_rep_legal', 'numero_doc_rep_legal',
            'pnombre_rep_legal', 'snombre_rep_legal',
            'papellido_rep_legal', 'sapellido_rep_legal',
            # Contactos por área
            'contacto_nomina', 'email_nomina',
            'contacto_rrhh', 'email_rrhh',
            'contacto_contabilidad', 'email_contabilidad',
            # Certificaciones
            'cargo_certificaciones', 'firma_certificaciones',
            # Banco empresa
            'banco_empresa', 'num_cuenta_empresa', 'tipo_cuenta_empresa',
            # PILA
            'clase_aportante', 'tipo_aportante',
            'empresa_exonerada', 'realizar_parafiscales',
            'vst_ccf', 'vst_sena_icbf', 'ige100',
            'sln_tarifa_pension', 'tipo_presentacion_planilla',
            'codigo_sucursal', 'nombre_sucursal',
            # Bridge Nomiweb
            'nomiweb_empresa_id',
        ]
        read_only_fields = ['id', 'created_at', 'nomiweb_empresa_id']

    def validate_nit(self, value):
        v = (value or '').strip()
        if v and not _colombia_nit_format_ok(v):
            raise serializers.ValidationError(
                'NIT: use entre 8 y 11 cifras (puede incluir un guion antes del DV).',
            )
        return v

    def validate(self, attrs):
        country = attrs.get('country')
        city = attrs.get('city')
        if self.instance:
            if country is None:
                country = self.instance.country
            if city is None:
                city = self.instance.city
        if city and country and city.state_province.country_id != country.id:
            raise serializers.ValidationError(
                {'city': 'La ciudad no pertenece al país seleccionado.'},
            )
        if city and not country:
            raise serializers.ValidationError(
                {'country': 'Seleccione un país antes de la ciudad.'},
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if instance.country_id:
            data['country'] = CountryNestedSerializer(instance.country).data
        else:
            data['country'] = None
        if instance.city_id:
            data['city'] = CityNestedSerializer(instance.city).data
        else:
            data['city'] = None
        if instance.arl_id:
            data['arl'] = ArlNestedSerializer(instance.arl).data
        else:
            data['arl'] = None
        if instance.banco_empresa_id:
            data['banco_empresa'] = BankNestedSerializer(instance.banco_empresa).data
        else:
            data['banco_empresa'] = None
        if instance.logo:
            url = instance.logo.url
            data['logo'] = request.build_absolute_uri(url) if request else url
        else:
            data['logo'] = None
        if instance.signature:
            url = instance.signature.url
            data['signature'] = request.build_absolute_uri(url) if request else url
        else:
            data['signature'] = None
        if instance.firma_certificaciones:
            url = instance.firma_certificaciones.url
            data['firma_certificaciones'] = request.build_absolute_uri(url) if request else url
        else:
            data['firma_certificaciones'] = None
        try:
            data['modules'] = TenantModulesAdminSerializer(instance.modules).data
        except TenantModules.DoesNotExist:
            data['modules'] = None
        return data

    def get_module_count(self, obj):
        try:
            m = obj.modules
        except TenantModules.DoesNotExist:
            return 0
        keys = [
            'hiring', 'personnel', 'quality', 'performance', 'evaluations',
            'portal', 'surveys', 'orgchart',
        ]
        return sum(1 for k in keys if getattr(m, k, False))

    def create(self, validated_data):
        validated_data.pop('clear_logo', None)
        validated_data.pop('clear_signature', None)
        modules_data = validated_data.pop('modules', None) or {}
        tenant = Tenant.objects.create(**validated_data)
        TenantModules.objects.create(
            tenant=tenant,
            hiring=modules_data.get('hiring', True),
            personnel=modules_data.get('personnel', True),
            quality=modules_data.get('quality', True),
            performance=modules_data.get('performance', True),
            evaluations=modules_data.get('evaluations', False),
            portal=modules_data.get('portal', False),
            surveys=modules_data.get('surveys', False),
            orgchart=modules_data.get('orgchart', False),
        )
        return tenant

    def update(self, instance, validated_data):
        modules_data = validated_data.pop('modules', None)
        clear_logo = validated_data.pop('clear_logo', False)
        clear_signature = validated_data.pop('clear_signature', False)

        if clear_logo:
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = None
        if clear_signature:
            if instance.signature:
                instance.signature.delete(save=False)
            instance.signature = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if modules_data is not None:
            m, _ = TenantModules.objects.get_or_create(tenant=instance)
            for key in TenantModulesAdminSerializer.Meta.fields:
                if key in modules_data:
                    setattr(m, key, modules_data[key])
            m.save()
        return instance
