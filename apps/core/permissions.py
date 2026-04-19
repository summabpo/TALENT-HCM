from rest_framework.permissions import BasePermission


class HasTenant(BasePermission):
    """Request must have a resolved tenant (set by TenantMiddleware)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request, 'tenant', None))


class HasRole(BasePermission):
    """Base class — subclass and set required_roles."""
    required_roles: list[str] = []

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return any(request.user.has_role(r) for r in self.required_roles)
