from rest_framework.authentication import BaseAuthentication
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SharedSessionAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'apps.core.authentication.SharedSessionAuthentication'
    name = 'SharedSession'

    def get_security_definition(self, auto_schema):
        return {'type': 'apiKey', 'in': 'cookie', 'name': 'nomiweb_session'}


class SharedSessionUser:
    """Represents the Nomiweb user reconstructed from the shared Redis session."""
    def __init__(self, session_data):
        self.id = session_data.get('_auth_user_id')
        self.email = session_data.get('user_email', '')
        self.full_name = session_data.get('user_full_name', '')
        self.roles = session_data.get('user_roles', [])
        self.tenant_id = session_data.get('tenant_id')
        self.is_authenticated = True
        self.is_anonymous = False

    def has_role(self, role):
        return role in self.roles

    def __str__(self):
        return self.email or str(self.id)


class SharedSessionAuthentication(BaseAuthentication):
    def authenticate(self, request):
        user_id = request.session.get('_auth_user_id')
        if not user_id:
            return None
        return (SharedSessionUser(request.session), None)

    def authenticate_header(self, request):
        return 'Session'
