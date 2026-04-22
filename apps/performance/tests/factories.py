import factory
from datetime import date
from decimal import Decimal
from factory.django import DjangoModelFactory
from apps.personnel.tests.factories import TenantFactory, TenantModulesFactory, EmployeeFactory
from apps.performance.models import (
    OKRPeriod, Objective, KeyResult, KeyResultUpdate,
    KPI, KPIMeasurement,
)


class OKRPeriodFactory(DjangoModelFactory):
    class Meta:
        model = OKRPeriod

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f'Q{(n % 4) + 1} {2026 + n // 4}')
    start_date = date(2026, 1, 1)
    end_date = date(2026, 3, 31)
    is_active = False


class ObjectiveFactory(DjangoModelFactory):
    class Meta:
        model = Objective

    tenant = factory.SubFactory(TenantFactory)
    period = factory.SubFactory(OKRPeriodFactory, tenant=factory.SelfAttribute('..tenant'))
    title = factory.Sequence(lambda n: f'Objective {n}')
    level = 'company'
    status = 'active'
    weight = Decimal('100.00')


class KeyResultFactory(DjangoModelFactory):
    class Meta:
        model = KeyResult

    tenant = factory.SubFactory(TenantFactory)
    objective = factory.SubFactory(ObjectiveFactory, tenant=factory.SelfAttribute('..tenant'))
    title = factory.Sequence(lambda n: f'Key Result {n}')
    metric_type = 'number'
    start_value = Decimal('0.00')
    target_value = Decimal('100.00')
    current_value = Decimal('0.00')
    weight = Decimal('100.00')


class KeyResultUpdateFactory(DjangoModelFactory):
    class Meta:
        model = KeyResultUpdate

    tenant = factory.SubFactory(TenantFactory)
    key_result = factory.SubFactory(KeyResultFactory, tenant=factory.SelfAttribute('..tenant'))
    previous_value = Decimal('0.00')
    new_value = Decimal('50.00')
    comment = 'Progress update'
    updated_by = 'hr@demo.co'


class KPIFactory(DjangoModelFactory):
    class Meta:
        model = KPI

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f'KPI {n}')
    metric_type = 'percentage'
    target_value = Decimal('90.00')
    frequency = 'monthly'
    is_active = True


class KPIMeasurementFactory(DjangoModelFactory):
    class Meta:
        model = KPIMeasurement

    tenant = factory.SubFactory(TenantFactory)
    kpi = factory.SubFactory(KPIFactory, tenant=factory.SelfAttribute('..tenant'))
    period_label = 'Enero 2026'
    period_date = date(2026, 1, 1)
    value = Decimal('85.00')
    recorded_by = 'hr@demo.co'
