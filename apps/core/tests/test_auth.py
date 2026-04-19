import pytest
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestMeView:
    url = '/api/v1/auth/me/'

    def _make_session_user(self, tenant):
        from apps.core.authentication import SharedSessionUser
        return SharedSessionUser({
            '_auth_user_id': '42',
            'user_email': 'hr@example.com',
            'user_full_name': 'HR Manager',
            'user_roles': ['admin', 'hr'],
            'tenant_id': str(tenant.id),
        })

    def test_me_returns_user_data(self, tenant, mock_user):
        client = APIClient()
        client.force_authenticate(user=mock_user)

        with patch('apps.core.middleware.Tenant.objects.get', return_value=tenant):
            response = client.get(self.url)

        assert response.status_code == 200
        data = response.json()
        assert data['email'] == mock_user.email
        assert data['roles'] == mock_user.roles

    def test_me_unauthenticated_returns_403(self):
        client = APIClient()
        response = client.get(self.url)
        assert response.status_code in (401, 403)

    def test_shared_session_user_has_role(self):
        from apps.core.authentication import SharedSessionUser
        user = SharedSessionUser({
            '_auth_user_id': '1',
            'user_roles': ['hr', 'manager'],
        })
        assert user.has_role('hr') is True
        assert user.has_role('admin') is False

    def test_shared_session_user_is_authenticated(self):
        from apps.core.authentication import SharedSessionUser
        user = SharedSessionUser({'_auth_user_id': '5'})
        assert user.is_authenticated is True
        assert user.is_anonymous is False

    def test_authentication_returns_none_without_session(self):
        from apps.core.authentication import SharedSessionAuthentication
        request = MagicMock()
        request.session = {}
        result = SharedSessionAuthentication().authenticate(request)
        assert result is None
