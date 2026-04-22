import factory
from datetime import date
from factory.django import DjangoModelFactory
from apps.personnel.tests.factories import TenantFactory, TenantModulesFactory, EmployeeFactory
from apps.hiring.models import (
    HiringProcess, Candidate,
    OnboardingChecklist, OnboardingTask,
    EmployeeOnboarding, OnboardingTaskCompletion,
)


class HiringProcessFactory(DjangoModelFactory):
    class Meta:
        model = HiringProcess

    tenant = factory.SubFactory(TenantFactory)
    position_title = factory.Sequence(lambda n: f'Position {n}')
    requested_by = 'HR Manager'
    status = 'open'
    positions_count = 1


class CandidateFactory(DjangoModelFactory):
    class Meta:
        model = Candidate

    tenant = factory.SubFactory(TenantFactory)
    hiring_process = factory.SubFactory(HiringProcessFactory, tenant=factory.SelfAttribute('..tenant'))
    full_name = factory.Sequence(lambda n: f'Candidate {n}')
    email = factory.Sequence(lambda n: f'candidate{n}@example.com')
    status = 'applied'


class OnboardingChecklistFactory(DjangoModelFactory):
    class Meta:
        model = OnboardingChecklist

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f'Checklist {n}')
    is_default = False


class OnboardingTaskFactory(DjangoModelFactory):
    class Meta:
        model = OnboardingTask

    tenant = factory.SubFactory(TenantFactory)
    checklist = factory.SubFactory(OnboardingChecklistFactory, tenant=factory.SelfAttribute('..tenant'))
    title = factory.Sequence(lambda n: f'Task {n}')
    order = factory.Sequence(lambda n: n)
    days_to_complete = 7


class EmployeeOnboardingFactory(DjangoModelFactory):
    class Meta:
        model = EmployeeOnboarding

    tenant = factory.SubFactory(TenantFactory)
    employee = factory.SubFactory(EmployeeFactory, tenant=factory.SelfAttribute('..tenant'))
    checklist = factory.SubFactory(OnboardingChecklistFactory, tenant=factory.SelfAttribute('..tenant'))
    start_date = date(2024, 1, 15)
    status = 'in_progress'


class OnboardingTaskCompletionFactory(DjangoModelFactory):
    class Meta:
        model = OnboardingTaskCompletion

    tenant = factory.SubFactory(TenantFactory)
    onboarding = factory.SubFactory(EmployeeOnboardingFactory, tenant=factory.SelfAttribute('..tenant'))
    task = factory.SubFactory(
        OnboardingTaskFactory,
        tenant=factory.SelfAttribute('..tenant'),
        checklist=factory.SelfAttribute('..onboarding.checklist'),
    )
