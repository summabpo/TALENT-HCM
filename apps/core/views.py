from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.core.permissions import HasTenant


class MeView(APIView):
    """
    Returns the current session user and resolved tenant.
    Called by the React frontend on app load to bootstrap auth state.
    GET /api/v1/auth/me/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None)
        return Response({
            'id': user.id,
            'email': user.email,
            'fullName': user.full_name,
            'roles': user.roles,
            'tenantId': user.tenant_id,
            'tenant': {
                'id': str(tenant.id),
                'name': tenant.name,
                'slug': tenant.slug,
            } if tenant else None,
        })
