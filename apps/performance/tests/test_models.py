import pytest
from decimal import Decimal
from apps.personnel.tests.factories import TenantFactory, EmployeeFactory, DepartmentFactory
from apps.performance.models import OKRPeriod, Objective, KeyResult, KeyResultUpdate, KPI, KPIMeasurement
from django.utils import timezone


@pytest.fixture
def perf_setup(db):
    tenant = TenantFactory()
    dept = DepartmentFactory(tenant=tenant)
    emp = EmployeeFactory(tenant=tenant, department=dept)
    period = OKRPeriod.objects.create(
        tenant=tenant, name='Q1 2026',
        start_date='2026-01-01', end_date='2026-03-31',
        is_active=True,
    )
    return tenant, dept, emp, period


@pytest.mark.django_db
class TestOKRPeriod:
    def test_only_one_active_period_per_tenant(self, perf_setup):
        tenant, dept, emp, period = perf_setup
        assert period.is_active is True

        period2 = OKRPeriod.objects.create(
            tenant=tenant, name='Q2 2026',
            start_date='2026-04-01', end_date='2026-06-30',
            is_active=True,
        )
        period.refresh_from_db()
        assert period.is_active is False
        assert period2.is_active is True


@pytest.mark.django_db
class TestKeyResult:
    def test_progress_percentage_at_zero(self, perf_setup):
        tenant, dept, emp, period = perf_setup
        obj = Objective.objects.create(
            tenant=tenant, period=period, title='Grow revenue',
            level='company', status='active',
        )
        kr = KeyResult.objects.create(
            tenant=tenant, objective=obj, title='Close 100 deals',
            metric_type='number', start_value=0, target_value=100, current_value=0,
        )
        assert kr.progress_percentage == 0.0

    def test_progress_percentage_complete(self, perf_setup):
        tenant, dept, emp, period = perf_setup
        obj = Objective.objects.create(
            tenant=tenant, period=period, title='Grow revenue',
            level='company', status='active',
        )
        kr = KeyResult.objects.create(
            tenant=tenant, objective=obj, title='Close 100 deals',
            metric_type='number', start_value=0, target_value=100, current_value=100,
        )
        assert kr.progress_percentage == 100.0

    def test_progress_percentage_partial(self, perf_setup):
        tenant, dept, emp, period = perf_setup
        obj = Objective.objects.create(
            tenant=tenant, period=period, title='Grow revenue',
            level='company', status='active',
        )
        kr = KeyResult.objects.create(
            tenant=tenant, objective=obj, title='Close 100 deals',
            metric_type='number', start_value=0, target_value=100, current_value=40,
        )
        assert kr.progress_percentage == 40.0

    def test_update_syncs_current_value(self, perf_setup):
        tenant, dept, emp, period = perf_setup
        obj = Objective.objects.create(
            tenant=tenant, period=period, title='Grow revenue',
            level='company', status='active',
        )
        kr = KeyResult.objects.create(
            tenant=tenant, objective=obj, title='Close 100 deals',
            metric_type='number', start_value=0, target_value=100, current_value=20,
        )
        KeyResultUpdate.objects.create(
            tenant=tenant, key_result=kr,
            previous_value=Decimal('20'), new_value=Decimal('55'),
            updated_by='hr@corp.com',
        )
        kr.refresh_from_db()
        assert kr.current_value == Decimal('55')


@pytest.mark.django_db
class TestKPI:
    def test_kpi_on_target(self, perf_setup):
        tenant, dept, emp, period = perf_setup
        kpi = KPI.objects.create(
            tenant=tenant, name='Customer Satisfaction', metric_type='percentage',
            target_value=Decimal('90'), frequency='monthly',
        )
        KPIMeasurement.objects.create(
            tenant=tenant, kpi=kpi,
            period_label='Enero 2026', period_date='2026-01-01',
            value=Decimal('92'), recorded_by='hr@corp.com',
        )
        latest = kpi.measurements.first()
        assert latest.value >= kpi.target_value
