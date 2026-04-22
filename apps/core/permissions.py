from rest_framework.permissions import BasePermission
from apps.core.models import Tenant


class IsDjangoSuperuser(BasePermission):
    """
    Escribir catálogos globales y operaciones de plataforma: solo is_superuser.
    (IsAdminUser de DRF exige is_staff, no basta con superusuario aislado).
    """
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_superuser)


class HasTenant(BasePermission):
    """Resolve tenant from JWT claims (runs after DRF auth, unlike middleware)."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        if getattr(request, 'tenant', None):
            return True
        tenant_id = getattr(request.user, '_jwt_tenant_id', None)
        if not tenant_id:
            return False
        try:
            request.tenant = Tenant.objects.get(id=tenant_id, is_active=True)
            return True
        except Tenant.DoesNotExist:
            return False


class HasRole(BasePermission):
    """Base class — subclass and set required_roles."""
    required_roles: list[str] = []

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        return any(request.user.has_role(r) for r in self.required_roles)


class HasModule(BasePermission):
    """Require a specific module to be enabled for the request's tenant."""
    module: str = ''

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        tenant = getattr(request, 'tenant', None)
        if not tenant or not self.module:
            return False
        try:
            return tenant.modules.is_enabled(self.module)
        except Exception:
            return False
