import uuid

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .models import Tenant, TenantModules
from .tenant_serializers import TenantAdminSerializer, TenantModulesAdminSerializer


class IsStaffUser(BasePermission):
    """User must be authenticated and staff or superuser (platform operators)."""

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        return bool(getattr(u, 'is_staff', False) or getattr(u, 'is_superuser', False))


class TenantAdminViewSet(viewsets.ModelViewSet):
    """
    Platform administration of tenants (multi-tenant SaaS operators).

    GET/POST   /api/v1/tenants/
    GET/PATCH/DELETE /api/v1/tenants/{id}/
    GET/PATCH  /api/v1/tenants/{id}/modules/
    """
    serializer_class = TenantAdminSerializer
    permission_classes = [IsStaffUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ['get', 'post', 'head', 'options', 'patch', 'delete']

    def get_queryset(self):
        qs = (
            Tenant.objects.select_related('modules', 'country', 'city', 'arl', 'banco_empresa')
            .all()
            .order_by('name')
        )
        user = self.request.user
        if not getattr(user, 'is_superuser', False):
            membership_ids = list(
                user.tenant_memberships.filter(is_active=True).values_list(
                    'tenant_id', flat=True,
                ),
            )
            jwt_tid = getattr(user, '_jwt_tenant_id', None)
            if membership_ids:
                if jwt_tid:
                    try:
                        active = uuid.UUID(str(jwt_tid))
                    except (ValueError, TypeError):
                        active = None
                    if active and active in membership_ids:
                        qs = qs.filter(pk=active)
                    elif active and active not in membership_ids:
                        qs = Tenant.objects.none()
                    else:
                        qs = qs.filter(pk__in=membership_ids)
                else:
                    qs = qs.filter(pk__in=membership_ids)
            else:
                qs = Tenant.objects.none()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search.strip())
        return qs

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            raise PermissionDenied(
                'Solo los superusuarios de la plataforma pueden crear empresas (tenants).',
            )
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.is_superuser:
            raise PermissionDenied(
                'Solo los superusuarios de la plataforma pueden eliminar empresas (tenants).',
            )
        instance.delete()

    @action(detail=True, methods=['get', 'patch'], url_path='modules')
    def modules(self, request, pk=None):
        tenant = self.get_object()
        modules_obj, _ = TenantModules.objects.get_or_create(tenant=tenant)
        if request.method == 'GET':
            return Response(TenantModulesAdminSerializer(modules_obj).data)
        if not request.user.is_superuser:
            raise PermissionDenied(
                'Solo el superadministrador de la plataforma puede modificar los módulos de una empresa.',
            )
        ser = TenantModulesAdminSerializer(
            modules_obj, data=request.data, partial=True,
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
