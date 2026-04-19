import pytest
from .factories import EmployeeFactory, DepartmentFactory, TenantFactory


@pytest.mark.django_db
class TestEmployee:
    def test_full_name_all_parts(self):
        emp = EmployeeFactory.build(
            first_name='Juan', second_name='Carlos',
            first_last_name='García', second_last_name='López',
        )
        assert emp.full_name == 'Juan Carlos García López'

    def test_full_name_minimal(self):
        emp = EmployeeFactory.build(
            first_name='Ana', second_name='',
            first_last_name='Ruiz', second_last_name='',
        )
        assert emp.full_name == 'Ana Ruiz'

    def test_employee_default_status(self):
        emp = EmployeeFactory.build()
        assert emp.status == 'active'
        assert emp.is_active is True

    def test_employee_has_global_id(self):
        emp = EmployeeFactory()
        assert emp.global_employee_id is not None

    def test_tenant_isolation(self):
        t1 = TenantFactory()
        t2 = TenantFactory()
        EmployeeFactory(tenant=t1)
        EmployeeFactory(tenant=t2)

        from apps.personnel.models import Employee
        assert Employee.objects.for_tenant(t1).count() == 1
        assert Employee.objects.for_tenant(t2).count() == 1


@pytest.mark.django_db
class TestDepartment:
    def test_department_hierarchy(self):
        tenant = TenantFactory()
        parent = DepartmentFactory(tenant=tenant, name='Operations')
        child = DepartmentFactory(tenant=tenant, name='HR', parent=parent)
        assert child.parent == parent
        assert parent.children.first() == child
