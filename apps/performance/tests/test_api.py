import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from apps.core.models import User
from apps.personnel.tests.factories import TenantFactory, TenantModulesFactory
from apps.performance.models import (
    OKRPeriod, Objective, KeyResult, KeyResultUpdate,
    KPI, KPIMeasurement,
)
from .factories import (
    OKRPeriodFactory, ObjectiveFactory, KeyResultFactory,
    KeyResultUpdateFactory, KPIFactory, KPIMeasurementFactory,
)


def _make_user(tenant):
    user = User.objects.create_user(
        email=f'perf_{tenant.slug}@test.co',
        password='pass',
        first_name='Perf',
        last_name='User',
    )
    user._jwt_tenant_id = str(tenant.id)
    user._jwt_roles = ['admin']
    return user


def _client_for(tenant, performance=True):
    TenantModulesFactory(tenant=tenant, performance=performance)
    client = APIClient()
    client.force_authenticate(user=_make_user(tenant))
    return client


# ─── Module permission ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestModulePermission:
    def test_performance_disabled_returns_403_on_periods(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, performance=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/performance/periods/').status_code == 403

    def test_performance_disabled_returns_403_on_objectives(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, performance=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/performance/objectives/').status_code == 403

    def test_performance_disabled_returns_403_on_kpis(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, performance=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/performance/kpis/').status_code == 403

    def test_performance_enabled_returns_200(self):
        tenant = TenantFactory()
        client = _client_for(tenant)
        assert client.get('/api/v1/performance/periods/').status_code == 200


# ─── Tenant isolation ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTenantIsolation:
    def test_period_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        period_a = OKRPeriodFactory(tenant=tenant_a)
        OKRPeriodFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/performance/periods/')
        assert response.status_code == 200
        ids = [p['id'] for p in response.json()['results']]
        assert str(period_a.id) in ids
        assert len(ids) == 1

    def test_objective_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        obj_a = ObjectiveFactory(tenant=tenant_a)
        ObjectiveFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/performance/objectives/')
        assert response.json()['count'] == 1
        assert response.json()['results'][0]['id'] == str(obj_a.id)

    def test_kpi_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        kpi_a = KPIFactory(tenant=tenant_a)
        KPIFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/performance/kpis/')
        assert response.json()['count'] == 1


# ─── Progress calculation ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestProgressCalculation:
    def test_kr_progress_zero_at_start(self):
        tenant = TenantFactory()
        objective = ObjectiveFactory(tenant=tenant)
        kr = KeyResultFactory(
            tenant=tenant, objective=objective,
            start_value=Decimal('0'), target_value=Decimal('100'), current_value=Decimal('0'),
        )
        assert kr.progress_percentage == 0.0

    def test_kr_progress_full_when_target_reached(self):
        tenant = TenantFactory()
        objective = ObjectiveFactory(tenant=tenant)
        kr = KeyResultFactory(
            tenant=tenant, objective=objective,
            start_value=Decimal('0'), target_value=Decimal('100'), current_value=Decimal('100'),
        )
        assert kr.progress_percentage == 100.0

    def test_kr_progress_partial(self):
        tenant = TenantFactory()
        objective = ObjectiveFactory(tenant=tenant)
        kr = KeyResultFactory(
            tenant=tenant, objective=objective,
            start_value=Decimal('0'), target_value=Decimal('200'), current_value=Decimal('50'),
        )
        assert kr.progress_percentage == 25.0

    def test_objective_progress_averages_key_results(self):
        tenant = TenantFactory()
        objective = ObjectiveFactory(tenant=tenant)
        # KR1: 50% — KR2: 100%  → weighted avg = (50+100)/2 = 75
        KeyResultFactory(
            tenant=tenant, objective=objective,
            start_value=Decimal('0'), target_value=Decimal('100'), current_value=Decimal('50'),
        )
        KeyResultFactory(
            tenant=tenant, objective=objective,
            start_value=Decimal('0'), target_value=Decimal('100'), current_value=Decimal('100'),
        )
        objective.refresh_from_db()
        assert objective.progress_percentage == 75.0

    def test_kr_update_via_api_advances_current_value(self):
        tenant = TenantFactory()
        objective = ObjectiveFactory(tenant=tenant)
        kr = KeyResultFactory(
            tenant=tenant, objective=objective,
            start_value=Decimal('0'), target_value=Decimal('100'), current_value=Decimal('20'),
        )

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/performance/key-results/{kr.id}/updates/',
            {'new_value': '60', 'updated_by': 'manager@demo.co', 'comment': 'Good progress'},
            format='json',
        )
        assert response.status_code == 201
        kr.refresh_from_db()
        assert kr.current_value == Decimal('60')

    def test_kr_update_sets_previous_value_automatically(self):
        tenant = TenantFactory()
        objective = ObjectiveFactory(tenant=tenant)
        kr = KeyResultFactory(
            tenant=tenant, objective=objective,
            start_value=Decimal('0'), target_value=Decimal('100'), current_value=Decimal('30'),
        )

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/performance/key-results/{kr.id}/updates/',
            {'new_value': '70', 'updated_by': 'manager@demo.co', 'comment': ''},
            format='json',
        )
        assert response.status_code == 201
        assert Decimal(str(response.json()['previous_value'])) == Decimal('30')


# ─── Nested URL scoping ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestNestedScoping:
    def test_objective_list_scoped_to_period(self):
        tenant = TenantFactory()
        period_a = OKRPeriodFactory(tenant=tenant)
        period_b = OKRPeriodFactory(tenant=tenant)
        obj_a = ObjectiveFactory(tenant=tenant, period=period_a)
        ObjectiveFactory(tenant=tenant, period=period_b)

        client = _client_for(tenant)
        response = client.get(f'/api/v1/performance/periods/{period_a.id}/objectives/')
        assert response.status_code == 200
        ids = [o['id'] for o in response.json()]
        assert str(obj_a.id) in ids
        assert len(ids) == 1

    def test_objective_detail_returns_404_under_wrong_period(self):
        tenant = TenantFactory()
        period_a = OKRPeriodFactory(tenant=tenant)
        period_b = OKRPeriodFactory(tenant=tenant)
        obj_b = ObjectiveFactory(tenant=tenant, period=period_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/performance/periods/{period_a.id}/objectives/{obj_b.id}/'
        )
        assert response.status_code == 404

    def test_kr_list_scoped_to_objective(self):
        tenant = TenantFactory()
        obj_a = ObjectiveFactory(tenant=tenant)
        obj_b = ObjectiveFactory(tenant=tenant)
        kr_a = KeyResultFactory(tenant=tenant, objective=obj_a)
        KeyResultFactory(tenant=tenant, objective=obj_b)

        client = _client_for(tenant)
        response = client.get(f'/api/v1/performance/objectives/{obj_a.id}/key-results/')
        assert response.status_code == 200
        ids = [k['id'] for k in response.json()]
        assert str(kr_a.id) in ids
        assert len(ids) == 1

    def test_kr_detail_returns_404_under_wrong_objective(self):
        tenant = TenantFactory()
        obj_a = ObjectiveFactory(tenant=tenant)
        obj_b = ObjectiveFactory(tenant=tenant)
        kr_b = KeyResultFactory(tenant=tenant, objective=obj_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/performance/objectives/{obj_a.id}/key-results/{kr_b.id}/'
        )
        assert response.status_code == 404

    def test_update_list_scoped_to_kr(self):
        tenant = TenantFactory()
        kr = KeyResultFactory(tenant=tenant)
        KeyResultUpdateFactory(tenant=tenant, key_result=kr)
        # Second KR with its own update
        kr2 = KeyResultFactory(tenant=tenant, objective=kr.objective)
        KeyResultUpdateFactory(tenant=tenant, key_result=kr2)

        client = _client_for(tenant)
        response = client.get(f'/api/v1/performance/key-results/{kr.id}/updates/')
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_update_detail_returns_404_under_wrong_kr(self):
        tenant = TenantFactory()
        kr_a = KeyResultFactory(tenant=tenant)
        kr_b = KeyResultFactory(tenant=tenant, objective=kr_a.objective)
        update_b = KeyResultUpdateFactory(tenant=tenant, key_result=kr_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/performance/key-results/{kr_a.id}/updates/{update_b.id}/'
        )
        assert response.status_code == 404

    def test_measurement_detail_returns_404_under_wrong_kpi(self):
        tenant = TenantFactory()
        kpi_a = KPIFactory(tenant=tenant)
        kpi_b = KPIFactory(tenant=tenant)
        measurement_b = KPIMeasurementFactory(tenant=tenant, kpi=kpi_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/performance/kpis/{kpi_a.id}/measurements/{measurement_b.id}/'
        )
        assert response.status_code == 404


# ─── Period filtering ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPeriodFiltering:
    def test_only_active_period_via_query_param(self):
        tenant = TenantFactory()
        active = OKRPeriodFactory(tenant=tenant, name='Q1 2026', is_active=True)
        OKRPeriodFactory(tenant=tenant, name='Q2 2026', is_active=False)

        client = _client_for(tenant)
        response = client.get('/api/v1/performance/periods/?active=true')
        assert response.status_code == 200
        assert response.json()['count'] == 1
        assert response.json()['results'][0]['id'] == str(active.id)

    def test_objectives_filter_by_period(self):
        tenant = TenantFactory()
        period_a = OKRPeriodFactory(tenant=tenant)
        period_b = OKRPeriodFactory(tenant=tenant)
        ObjectiveFactory(tenant=tenant, period=period_a)
        ObjectiveFactory(tenant=tenant, period=period_b)

        client = _client_for(tenant)
        response = client.get(f'/api/v1/performance/objectives/?period={period_a.id}')
        assert response.json()['count'] == 1


# ─── OKR period activation ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestOKRPeriodActivation:
    def test_only_one_active_period_per_tenant(self):
        tenant = TenantFactory()
        p1 = OKRPeriodFactory(tenant=tenant, name='Q1', is_active=True)
        p2 = OKRPeriodFactory(tenant=tenant, name='Q2', is_active=True)

        p1.refresh_from_db()
        assert p1.is_active is False
        assert p2.is_active is True


# ─── KPI measurements ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestKPIMeasurements:
    def test_measurements_list_via_action(self):
        tenant = TenantFactory()
        kpi = KPIFactory(tenant=tenant)
        KPIMeasurementFactory(tenant=tenant, kpi=kpi, period_date='2026-01-01', period_label='Ene')
        KPIMeasurementFactory(tenant=tenant, kpi=kpi, period_date='2026-02-01', period_label='Feb')

        client = _client_for(tenant)
        response = client.get(f'/api/v1/performance/kpis/{kpi.id}/measurements/')
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_measurement_delete_via_nested_url(self):
        tenant = TenantFactory()
        kpi = KPIFactory(tenant=tenant)
        m = KPIMeasurementFactory(tenant=tenant, kpi=kpi)

        client = _client_for(tenant)
        response = client.delete(
            f'/api/v1/performance/kpis/{kpi.id}/measurements/{m.id}/'
        )
        assert response.status_code == 204
        assert not KPIMeasurement.objects.filter(id=m.id).exists()

    def test_kpi_not_on_target_when_below_threshold(self):
        tenant = TenantFactory()
        kpi = KPIFactory(tenant=tenant, target_value=Decimal('90'))
        KPIMeasurementFactory(tenant=tenant, kpi=kpi, value=Decimal('75'))

        latest = kpi.measurements.order_by('-period_date').first()
        assert float(latest.value) < float(kpi.target_value)
