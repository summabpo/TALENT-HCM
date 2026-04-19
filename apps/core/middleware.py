from django.shortcuts import redirect
from apps.core.models import Tenant


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            tenant_id = request.session.get('tenant_id')
            if tenant_id:
                try:
                    request.tenant = Tenant.objects.get(id=tenant_id, is_active=True)
                except Tenant.DoesNotExist:
                    pass
        return self.get_response(request)


class LoginRedirectMiddleware:
    """API returns 401. Browser navigation redirects to Nomiweb login."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if response.status_code == 401 and not request.path.startswith('/api/'):
            return redirect(f'https://nomiweb.co/login/?next={request.build_absolute_uri()}')
        return response
