"""
Superuser (platform admin) has no UserTenant; login + DRF permissions must allow
global admin use cases without a tenant in the JWT.

Superuser *with* UserTenant should log in as a normal tenant user (tenant + modules in JWT),
not as platform admin — so e.g. admin@demo.co can use operational modules in the app.
"""
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Role, Tenant, TenantModules, User, UserTenant


@pytest.fixture
def superuser_no_membership(db):
    return User.objects.create_superuser(
        email='super@platform.test',
        password='super-secure-123!',
        first_name='Super',
        last_name='Admin',
    )


@pytest.mark.django_db
class TestLoginPlatformAdmin:
    url = '/api/v1/auth/login/'

    def test_superuser_login_without_tenant_succeeds(self, superuser_no_membership):
        client = APIClient()
        res = client.post(
            self.url,
            {'email': 'super@platform.test', 'password': 'super-secure-123!'},
            format='json',
        )
        assert res.status_code == 200
        data = res.json()
        assert data['tenant'] is None
        assert data['user']['is_superuser'] is True
        assert 'access' in data

    @pytest.mark.django_db
    def test_superuser_with_tenant_gets_tenant_jwt(self, db):
        u = User.objects.create_superuser(
            email='su.demo@co.test',
            password='demo-secure-123!',
            first_name='Super',
            last_name='Tenant',
        )
        t = Tenant.objects.create(name='Demo Co', slug='demosu')
        TenantModules.objects.create(
            tenant=t, hiring=True, personnel=True, quality=True, performance=True,
        )
        r = Role.objects.get_or_create(name=Role.Name.ADMIN)[0]
        m = UserTenant.objects.create(user=u, tenant=t, is_active=True)
        m.roles.add(r)

        client = APIClient()
        res = client.post(
            self.url,
            {'email': 'su.demo@co.test', 'password': 'demo-secure-123!'},
            format='json',
        )
        assert res.status_code == 200
        data = res.json()
        assert data['user']['is_superuser'] is True
        assert data['tenant'] is not None
        assert data['tenant']['slug'] == 'demosu'
        assert data['modules'].get('personnel') is True
        assert 'tenant_id' in AccessToken(data['access'])

    def test_login_unauthenticated_hits_middleware(self):
        post = APIClient()
        r = post.post(self.url, {'email': 'nope', 'password': 'x'}, format='json')
        assert r.status_code == 400


@pytest.mark.django_db
class TestHasTenantWithSuperuser:
    """GET /api/v1/personnel/employees/ uses [HasTenant, HasModule]."""

    def test_superuser_employee_list_returns_200(self, superuser_no_membership):
        client = APIClient()
        client.force_authenticate(user=superuser_no_membership)
        superuser_no_membership._jwt_tenant_id = None
        superuser_no_membership._jwt_roles = []
        res = client.get('/api/v1/personnel/employees/')
        assert res.status_code == 200

    def test_authenticated_user_without_tenant_403(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        user._jwt_tenant_id = None
        user._jwt_roles = []
        res = client.get('/api/v1/personnel/employees/')
        assert res.status_code == 403

    def test_user_with_tenant_200(self, user, membership):
        client = APIClient()
        client.force_authenticate(user=user)
        user._jwt_tenant_id = str(membership.tenant_id)
        user._jwt_roles = ['admin']
        res = client.get('/api/v1/personnel/employees/')
        assert res.status_code == 200


@pytest.mark.django_db
class TestMeViewSuperuser:
    url = '/api/v1/auth/me/'

    def test_me_superuser_flags(self, superuser_no_membership):
        t = AccessToken.for_user(superuser_no_membership)
        client = APIClient()
        res = client.get(self.url, HTTP_AUTHORIZATION=f'Bearer {t}')
        assert res.status_code == 200
        body = res.json()
        assert body['user']['is_superuser'] is True
        assert body['user']['is_staff'] is True
        assert body['tenant'] is None
