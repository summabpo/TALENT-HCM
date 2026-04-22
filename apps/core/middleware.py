from apps.core.models import Tenant

# No tenant resolution (Django admin, static, auth API, OpenAPI). JWT is applied in DRF, not
# here, so /api/* usually sees AnonymousUser; actual tenant checks are Has* permissions.
def _is_tenant_middleware_exempt_path(path: str) -> bool:
    if path.startswith('/admin'):
        return True
    if path.startswith('/static/') or path.startswith('/media/'):
        return True
    if path.startswith('/api/v1/auth/'):
        return True
    if path.startswith('/api/schema') or path.startswith('/api/v1/schema'):
        return True
    if path.startswith('/__debug__/'):
        return True
    return False


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None
        if _is_tenant_middleware_exempt_path(request.path):
            return self.get_response(request)
        u = getattr(request, 'user', None)
        if u and u.is_authenticated and u.is_superuser:
            return self.get_response(request)
        if u and u.is_authenticated:
            tenant_id = getattr(u, '_jwt_tenant_id', None)
            if tenant_id:
                try:
                    request.tenant = Tenant.objects.get(id=tenant_id, is_active=True)
                except Tenant.DoesNotExist:
                    pass
        return self.get_response(request)
