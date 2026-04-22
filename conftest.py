import pytest
from rest_framework.test import APIClient


@pytest.fixture
def tenant(db):
    from apps.core.models import Tenant, TenantModules
    t = Tenant.objects.create(name='Test Corp', slug='test-corp')
    TenantModules.objects.create(tenant=t)
    return t


@pytest.fixture
def user(db):
    from apps.core.models import User
    return User.objects.create_user(
        email='test@test-corp.com',
        password='testpass123!',
        first_name='Test',
        last_name='User',
    )


@pytest.fixture
def membership(db, user, tenant):
    from apps.core.models import Role, UserTenant
    admin_role, _ = Role.objects.get_or_create(name=Role.Name.ADMIN)
    m = UserTenant.objects.create(user=user, tenant=tenant)
    m.roles.add(admin_role)
    return m


@pytest.fixture
def api_client(user, tenant, membership):
    """Authenticated API client with tenant and roles attached via JWT-like mechanism."""
    client = APIClient()
    user._jwt_tenant_id = str(tenant.id)
    user._jwt_roles = ['admin']
    client.force_authenticate(user=user)
    return client
