import pytest
from rest_framework.test import APIClient
from apps.core.models import User
from apps.catalogs.models import SocialSecurityEntityType
from .factories import (
    TenantFactory, TenantModulesFactory, EmployeeFactory,
    DepartmentFactory, ContractFactory, SocialSecurityEntityFactory,
)


def _make_user(tenant, roles=None):
    user = User.objects.create_user(
        email=f'user_{tenant.slug}@test.co',
        password='pass',
        first_name='Test',
        last_name='User',
    )
    user._jwt_tenant_id = str(tenant.id)
    user._jwt_roles = roles or ['admin']
    return user


def _client_for(tenant, modules_kwargs=None):
    mods_kw = {'personnel': True, **(modules_kwargs or {})}
    TenantModulesFactory(tenant=tenant, **mods_kw)
    client = APIClient()
    client.force_authenticate(user=_make_user(tenant))
    return client


@pytest.mark.django_db
class TestTenantIsolation:
    def test_employee_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        emp_a = EmployeeFactory(tenant=tenant_a)
        EmployeeFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/personnel/employees/')

        assert response.status_code == 200
        ids = [e['id'] for e in response.json()['results']]
        assert str(emp_a.id) in ids
        assert len(ids) == 1

    def test_department_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        dept_a = DepartmentFactory(tenant=tenant_a)
        DepartmentFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/personnel/departments/')

        assert response.status_code == 200
        ids = [d['id'] for d in response.json()['results']]
        assert str(dept_a.id) in ids
        assert len(ids) == 1


@pytest.mark.django_db
class TestModulePermission:
    def test_personnel_disabled_returns_403(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, personnel=False)
        EmployeeFactory(tenant=tenant)

        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        response = client.get('/api/v1/personnel/employees/')

        assert response.status_code == 403

    def test_personnel_enabled_returns_200(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, personnel=True)

        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        response = client.get('/api/v1/personnel/employees/')

        assert response.status_code == 200


@pytest.mark.django_db
class TestContractSSEntityFKs:
    def test_contract_with_valid_ss_entities(self):
        tenant = TenantFactory()
        emp = EmployeeFactory(tenant=tenant)
        contract = ContractFactory(tenant=tenant, employee=emp)

        assert contract.eps.entity_type == SocialSecurityEntityType.EPS
        assert contract.ccf.entity_type == SocialSecurityEntityType.CCF

    def test_contract_list_via_employee_action(self):
        tenant = TenantFactory()
        emp = EmployeeFactory(tenant=tenant)
        ContractFactory(tenant=tenant, employee=emp)

        client = _client_for(tenant)
        response = client.get(f'/api/v1/personnel/employees/{emp.id}/contracts/')

        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_contract_detail_via_nested_url(self):
        tenant = TenantFactory()
        emp = EmployeeFactory(tenant=tenant)
        contract = ContractFactory(tenant=tenant, employee=emp)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/personnel/employees/{emp.id}/contracts/{contract.id}/'
        )

        assert response.status_code == 200
        assert response.json()['id'] == str(contract.id)

    def test_contract_nested_url_scoped_to_employee(self):
        """Contract belonging to another employee returns 404."""
        tenant = TenantFactory()
        emp_a = EmployeeFactory(tenant=tenant)
        emp_b = EmployeeFactory(tenant=tenant)
        contract_b = ContractFactory(tenant=tenant, employee=emp_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/personnel/employees/{emp_a.id}/contracts/{contract_b.id}/'
        )

        assert response.status_code == 404
