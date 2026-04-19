import pytest
from apps.personnel.tests.factories import TenantFactory, EmployeeFactory, DepartmentFactory
from apps.quality.models import (
    QualityProcess, NonConformity, ContinuousImprovement,
)


@pytest.fixture
def quality_setup(db):
    tenant = TenantFactory()
    dept = DepartmentFactory(tenant=tenant)
    emp = EmployeeFactory(tenant=tenant, department=dept)
    process = QualityProcess.objects.create(
        tenant=tenant, code='PR-RH-001', name='Gestión de Personal',
        owner=emp, department=dept,
    )
    return tenant, emp, process


@pytest.mark.django_db
class TestNonConformity:
    def test_create_nonconformity(self, quality_setup):
        tenant, emp, process = quality_setup
        nc = NonConformity.objects.create(
            tenant=tenant,
            code='NC-001',
            source='audit',
            description='Documentos desactualizados',
            responsible=emp,
            status='open',
        )
        assert nc.closed_at is None
        assert nc.effectiveness_verified is False

    def test_code_unique_per_tenant(self, quality_setup):
        from django.db import IntegrityError
        tenant, emp, process = quality_setup
        NonConformity.objects.create(
            tenant=tenant, code='NC-DUP', source='process',
            description='First', responsible=emp,
        )
        with pytest.raises(IntegrityError):
            NonConformity.objects.create(
                tenant=tenant, code='NC-DUP', source='employee',
                description='Duplicate', responsible=emp,
            )


@pytest.mark.django_db
class TestContinuousImprovement:
    def test_default_status_and_priority(self, quality_setup):
        tenant, emp, process = quality_setup
        improvement = ContinuousImprovement.objects.create(
            tenant=tenant,
            code='CI-001',
            title='Automatizar firma de documentos',
            description='Usar firma digital',
            proposed_by=emp,
            responsible=emp,
        )
        assert improvement.status == 'proposed'
        assert improvement.priority == 'medium'
