import pytest
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
def staff_user(db):
    return User.objects.create_user(
        email='staff@summa.co',
        password='pass1234!',
        first_name='Staff',
        last_name='Admin',
        is_staff=True,
    )


@pytest.fixture
def superuser(db):
    return User.objects.create_user(
        email='super@summa.co',
        password='pass1234!',
        first_name='Super',
        last_name='Admin',
        is_staff=True,
        is_superuser=True,
    )


@pytest.fixture
def staff_membership(db, staff_user, tenant, admin_role):
    m = UserTenant.objects.create(user=staff_user, tenant=tenant)
    m.roles.add(admin_role)
    return m


@pytest.fixture
def normal_user(db):
    return User.objects.create_user(
        email='user@acme.co',
        password='pass1234!',
        first_name='U',
        last_name='Ser',
        is_staff=False,
    )


@pytest.fixture
def normal_membership(db, normal_user, tenant, admin_role):
    m = UserTenant.objects.create(user=normal_user, tenant=tenant)
    m.roles.add(admin_role)
    return m


@pytest.mark.django_db
class TestTenantAdminAPI:
    list_url = '/api/v1/tenants/'

    def test_non_staff_forbidden(self, normal_user, normal_membership):
        client = APIClient()
        client.force_authenticate(user=normal_user)
        res = client.get(self.list_url)
        assert res.status_code == 403

    def test_staff_can_list(self, staff_user, staff_membership):
        client = APIClient()
        client.force_authenticate(user=staff_user)
        res = client.get(self.list_url)
        assert res.status_code == 200
        data = res.json()
        assert 'results' in data
        assert data['count'] >= 1

    def test_staff_only_sees_own_tenants(self, staff_user, staff_membership, tenant):
        other = Tenant.objects.create(name='Other SA', slug='other-sa')
        TenantModules.objects.create(tenant=other)
        client = APIClient()
        client.force_authenticate(user=staff_user)
        res = client.get(self.list_url)
        assert res.status_code == 200
        data = res.json()
        ids = {r['id'] for r in data['results']}
        assert str(tenant.id) in ids
        assert str(other.id) not in ids
        assert data['count'] == 1

    def test_staff_cannot_create_tenant(self, staff_user, staff_membership):
        client = APIClient()
        client.force_authenticate(user=staff_user)
        res = client.post(
            self.list_url,
            {'name': 'New Co', 'slug': 'new-co', 'is_active': True},
            format='json',
        )
        assert res.status_code == 403

    def test_superuser_can_create_tenant(self, superuser):
        client = APIClient()
        client.force_authenticate(user=superuser)
        res = client.post(
            self.list_url,
            {'name': 'New Co', 'slug': 'new-co', 'is_active': True},
            format='json',
        )
        assert res.status_code == 201
        assert res.json()['slug'] == 'new-co'
        assert Tenant.objects.filter(slug='new-co').exists()

    def test_staff_cannot_delete_tenant(self, staff_user, staff_membership, tenant):
        client = APIClient()
        client.force_authenticate(user=staff_user)
        url = f'{self.list_url}{tenant.id}/'
        res = client.delete(url)
        assert res.status_code == 403
        assert Tenant.objects.filter(pk=tenant.pk).exists()
