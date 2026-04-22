from rest_framework_simplejwt.authentication import JWTAuthentication
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class TalentJWTAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'apps.core.authentication.TalentJWTAuthentication'
    name = 'TalentJWT'

    def get_security_definition(self, auto_schema):
        return {'type': 'http', 'scheme': 'bearer', 'bearerFormat': 'JWT'}


class TalentJWTAuthentication(JWTAuthentication):
    """JWT auth that attaches tenant_id and roles from token claims to request.user."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        user._jwt_tenant_id = token.get('tenant_id')
        user._jwt_roles = token.get('roles', [])
        return (user, token)
