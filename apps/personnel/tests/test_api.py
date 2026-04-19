import pytest
from unittest.mock import patch, PropertyMock
from rest_framework.test import APIClient
from .factories import TenantFactory, EmployeeFactory, DepartmentFactory


@pytest.fixture
def setup(db):
    tenant = TenantFactory()
    dept = DepartmentFactory(tenant=tenant)
    emp = EmployeeFactory(tenant=tenant, department=dept)

    mock_user = type('User', (), {
        'id': '1', 'email': 'hr@corp.com', 'full_name': 'HR',
        'roles': ['admin'], 'tenant_id': str(tenant.id),
        'is_authenticated': True, 'is_anonymous': False,
        'has_role': lambda self, r: True,
    })()

    client = APIClient()
    client.force_authenticate(user=mock_user)
    return client, tenant, dept, emp


@pytest.mark.django_db
class TestEmployeeAPI:
    def test_list_employees_filtered_by_tenant(self, setup):
        client, tenant, dept, emp = setup
        other_tenant = TenantFactory()
        EmployeeFactory(tenant=other_tenant)

        with patch('apps.core.middleware.TenantMiddleware.__call__') as _:
            with patch('apps.personnel.views.EmployeeViewSet.get_queryset') as mock_qs:
                from apps.personnel.models import Employee
                mock_qs.return_value = Employee.objects.filter(tenant=tenant)
                response = client.get('/api/v1/personnel/employees/')

        assert response.status_code == 200

    def test_get_employee_detail(self, setup):
        client, tenant, dept, emp = setup
        with patch('apps.personnel.views.EmployeeViewSet.get_queryset') as mock_qs:
            from apps.personnel.models import Employee
            mock_qs.return_value = Employee.objects.filter(tenant=tenant)
            response = client.get(f'/api/v1/personnel/employees/{emp.id}/')
        assert response.status_code == 200
        assert response.json()['id'] == str(emp.id)


@pytest.mark.django_db
class TestDepartmentAPI:
    def test_list_departments(self, setup):
        client, tenant, dept, emp = setup
        with patch('apps.personnel.views.DepartmentViewSet.get_queryset') as mock_qs:
            from apps.personnel.models import Department
            mock_qs.return_value = Department.objects.filter(tenant=tenant)
            response = client.get('/api/v1/personnel/departments/')
        assert response.status_code == 200
        results = response.json()['results']
        assert any(d['name'] == dept.name for d in results)
