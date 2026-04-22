from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Tenant, TenantModules, User, UserTenant


class TenantSerializer(serializers.ModelSerializer):
    """Base serializer that auto-injects tenant on create."""

    class Meta:
        read_only_fields = ['tenant', 'id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super().create(validated_data)


class TenantSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug']


class TenantModulesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantModules
        fields = [
            'hiring', 'personnel', 'quality', 'performance', 'evaluations',
            'portal', 'surveys', 'orgchart',
        ]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    tenant_id = serializers.UUIDField(required=False, help_text=_('Required when user belongs to multiple tenants'))

    def validate(self, attrs):
        user = authenticate(username=attrs['email'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError(_('Invalid credentials.'), code='authorization')
        if not user.is_active:
            raise serializers.ValidationError(_('Account is disabled.'), code='authorization')

        memberships = (
            UserTenant.objects
            .filter(user=user, is_active=True, tenant__is_active=True)
            .select_related('tenant')
            .prefetch_related('roles')
        )

        # Plataforma: solo superusuarios sin ningún tenant activo
        if user.is_superuser and not memberships.exists():
            attrs['user'] = user
            attrs['platform_admin'] = True
            return attrs

        if not memberships.exists():
            raise serializers.ValidationError(_('User has no active tenant.'), code='authorization')

        if attrs.get('tenant_id'):
            try:
                membership = memberships.get(tenant_id=attrs['tenant_id'])
            except UserTenant.DoesNotExist:
                raise serializers.ValidationError(_('Tenant not found or not accessible.'), code='authorization')
        elif memberships.count() == 1:
            membership = memberships.first()
        else:
            raise serializers.ValidationError(
                {
                    'tenant_required': True,
                    'tenants': TenantSummarySerializer(
                        [m.tenant for m in memberships], many=True
                    ).data,
                }
            )

        attrs['user'] = user
        attrs['membership'] = membership
        return attrs


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(_('A user with this email already exists.'))
        return value.lower()

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
        )


class TokenResponseSerializer(serializers.Serializer):
    """Documents the token pair response shape."""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = serializers.DictField()
    tenant = TenantSummarySerializer()


def issue_platform_admin_tokens(user: User) -> dict:
    """
    Token pair for platform superusers with no UserTenant. No tenant_id in JWT
    (clients treat global admin as outside any tenant).
    """
    refresh = RefreshToken.for_user(user)
    refresh['roles'] = []
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': str(user.id),
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'fullName': user.full_name,
            'roles': [],
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        },
        'tenant': None,
        'modules': {},
    }


def issue_tokens(user: User, membership: UserTenant) -> dict:
    """Build a JWT token pair with tenant_id and roles embedded."""
    roles = membership.get_role_names()
    tenant = membership.tenant

    refresh = RefreshToken.for_user(user)
    refresh['tenant_id'] = str(tenant.id)
    refresh['roles'] = roles

    modules_data = {}
    try:
        modules_data = TenantModulesSerializer(tenant.modules).data
    except TenantModules.DoesNotExist:
        pass

    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': str(user.id),
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'fullName': user.full_name,
            'roles': roles,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        },
        'tenant': TenantSummarySerializer(tenant).data,
        'modules': modules_data,
    }
