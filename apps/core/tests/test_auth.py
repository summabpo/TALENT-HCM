import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import Role, Tenant, TenantModules, User, UserTenant


@pytest.fixture
def tenant(db):
    t = Tenant.objects.create(name='Acme', slug='acme')
    TenantModules.objects.create(tenant=t)
    return t


@pytest.fixture
def admin_role(db):
    return Role.objects.create(name=Role.Name.ADMIN)


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='hr@acme.co',
        password='pass1234!',
        first_name='HR',
        last_name='Manager',
    )


@pytest.fixture
def membership(db, user, tenant, admin_role):
    m = UserTenant.objects.create(user=user, tenant=tenant)
    m.roles.add(admin_role)
    return m


@pytest.mark.django_db
class TestLoginView:
    url = '/api/v1/auth/login/'

    def test_login_returns_tokens(self, user, membership):
        client = APIClient()
        res = client.post(self.url, {'email': 'hr@acme.co', 'password': 'pass1234!'}, format='json')
        assert res.status_code == 200
        data = res.json()
        assert 'access' in data
        assert 'refresh' in data
        assert data['user']['email'] == 'hr@acme.co'
        assert data['tenant']['slug'] == 'acme'
        assert 'admin' in data['user']['roles']

    def test_login_invalid_credentials(self, user, membership):
        client = APIClient()
        res = client.post(self.url, {'email': 'hr@acme.co', 'password': 'wrong'}, format='json')
        assert res.status_code == 400

    def test_login_requires_tenant_when_multiple(self, user, db):
        t2 = Tenant.objects.create(name='Beta', slug='beta')
        TenantModules.objects.create(tenant=t2)
        m2 = UserTenant.objects.create(user=user, tenant=t2)
        m2.roles.add(Role.objects.create(name=Role.Name.MANAGER))

        from apps.core.models import Role as R
        tenant1 = Tenant.objects.get(slug='acme') if Tenant.objects.filter(slug='acme').exists() else None
        # If user has 2 memberships, login without tenant_id returns tenant_required
        # This test creates a fresh user with 2 tenants
        u2 = User.objects.create_user(email='multi@example.co', password='pass1234!', first_name='A', last_name='B')
        ta = Tenant.objects.create(name='TenantA', slug='ta')
        tb = Tenant.objects.create(name='TenantB', slug='tb')
        TenantModules.objects.create(tenant=ta)
        TenantModules.objects.create(tenant=tb)
        role = R.objects.get_or_create(name=R.Name.EMPLOYEE)[0]
        ma = UserTenant.objects.create(user=u2, tenant=ta)
        ma.roles.add(role)
        mb = UserTenant.objects.create(user=u2, tenant=tb)
        mb.roles.add(role)

        client = APIClient()
        res = client.post(self.url, {'email': 'multi@example.co', 'password': 'pass1234!'}, format='json')
        assert res.status_code == 200
        assert res.json().get('tenant_required') is True
        assert len(res.json()['tenants']) == 2


@pytest.mark.django_db
class TestMeView:
    url = '/api/v1/auth/me/'

    def test_me_returns_user_data(self, user, membership):
        client = APIClient()
        client.force_authenticate(user=user)
        user._jwt_tenant_id = str(membership.tenant.id)
        user._jwt_roles = ['admin']

        from unittest.mock import patch
        with patch('apps.core.middleware.Tenant.objects.get', return_value=membership.tenant):
            res = client.get(self.url)

        assert res.status_code == 200
        data = res.json()
        assert data['user']['email'] == user.email
        assert 'admin' in data['user']['roles']

    def test_me_unauthenticated_returns_401(self):
        client = APIClient()
        res = client.get(self.url)
        assert res.status_code in (401, 403)
