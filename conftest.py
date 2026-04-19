import pytest
from unittest.mock import MagicMock
from rest_framework.test import APIClient


@pytest.fixture
def tenant(db):
    from apps.core.models import Tenant
    return Tenant.objects.create(name='Test Corp', slug='test-corp')


@pytest.fixture
def mock_user(tenant):
    user = MagicMock()
    user.id = '1'
    user.email = 'test@test-corp.com'
    user.full_name = 'Test User'
    user.roles = ['admin']
    user.tenant_id = str(tenant.id)
    user.is_authenticated = True
    user.is_anonymous = False
    user.has_role = lambda role: role in user.roles
    return user


@pytest.fixture
def api_client(mock_user, tenant):
    client = APIClient()
    client.force_authenticate(user=mock_user)
    client.tenant = tenant

    # Patch tenant onto request via middleware simulation
    from unittest.mock import patch
    original_initial = None

    class TenantAPIClient(APIClient):
        def _get_kwargs(self, *args, **kwargs):
            return super()._get_kwargs(*args, **kwargs)

    return client


@pytest.fixture
def auth_client(mock_user, tenant, settings):
    """APIClient with authenticated user and tenant set on every request."""
    client = APIClient()
    client.force_authenticate(user=mock_user)
    return client, tenant
