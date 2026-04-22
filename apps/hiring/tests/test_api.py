import pytest
from rest_framework.test import APIClient
from apps.core.models import User
from apps.catalogs.models import DocumentType
from apps.personnel.models import Employee
from apps.personnel.tests.factories import TenantFactory, TenantModulesFactory, DepartmentFactory
from apps.hiring.models import OnboardingTaskCompletion
from .factories import (
    HiringProcessFactory, CandidateFactory,
    OnboardingChecklistFactory, OnboardingTaskFactory,
    EmployeeOnboardingFactory,
)


def _make_user(tenant):
    user = User.objects.create_user(
        email=f'user_{tenant.slug}@test.co',
        password='pass',
        first_name='Test',
        last_name='User',
    )
    user._jwt_tenant_id = str(tenant.id)
    user._jwt_roles = ['admin']
    return user


def _client_for(tenant, hiring=True):
    TenantModulesFactory(tenant=tenant, hiring=hiring)
    client = APIClient()
    client.force_authenticate(user=_make_user(tenant))
    return client


def _doc_type():
    dt, _ = DocumentType.objects.get_or_create(
        code='CC', defaults={'name': 'Cédula de Ciudadanía', 'dian_code': 13}
    )
    return dt


@pytest.mark.django_db
class TestTenantIsolation:
    def test_process_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        process_a = HiringProcessFactory(tenant=tenant_a)
        HiringProcessFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/hiring/processes/')

        assert response.status_code == 200
        ids = [p['id'] for p in response.json()['results']]
        assert str(process_a.id) in ids
        assert len(ids) == 1

    def test_candidate_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        process_a = HiringProcessFactory(tenant=tenant_a)
        process_b = HiringProcessFactory(tenant=tenant_b)
        cand_a = CandidateFactory(tenant=tenant_a, hiring_process=process_a)
        CandidateFactory(tenant=tenant_b, hiring_process=process_b)

        client = _client_for(tenant_a)
        response = client.get(f'/api/v1/hiring/processes/{process_a.id}/candidates/')

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]['id'] == str(cand_a.id)


@pytest.mark.django_db
class TestModulePermission:
    def test_hiring_disabled_returns_403_on_processes(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, hiring=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/hiring/processes/').status_code == 403

    def test_hiring_disabled_returns_403_on_checklists(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, hiring=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/hiring/onboarding-checklists/').status_code == 403

    def test_hiring_enabled_returns_200(self):
        tenant = TenantFactory()
        client = _client_for(tenant, hiring=True)
        assert client.get('/api/v1/hiring/processes/').status_code == 200


@pytest.mark.django_db
class TestHireAction:
    def test_hire_creates_employee_with_global_id(self):
        tenant = TenantFactory()
        dept = DepartmentFactory(tenant=tenant)
        doc_type = _doc_type()
        process = HiringProcessFactory(tenant=tenant, department=dept)
        candidate = CandidateFactory(tenant=tenant, hiring_process=process, full_name='Ana Torres')

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/hiring/processes/{process.id}/candidates/{candidate.id}/hire/',
            {'document_type': doc_type.id, 'document_number': 9876543210},
            format='json',
        )

        assert response.status_code == 200
        employee_id = response.json()['employee_id']
        emp = Employee.objects.get(id=employee_id)
        assert emp.global_employee_id is not None
        assert emp.first_name == 'Ana'
        assert emp.tenant == tenant

    def test_hire_marks_candidate_as_hired(self):
        tenant = TenantFactory()
        doc_type = _doc_type()
        process = HiringProcessFactory(tenant=tenant)
        candidate = CandidateFactory(tenant=tenant, hiring_process=process)

        client = _client_for(tenant)
        client.post(
            f'/api/v1/hiring/processes/{process.id}/candidates/{candidate.id}/hire/',
            {'document_type': doc_type.id, 'document_number': 1234567890},
            format='json',
        )

        candidate.refresh_from_db()
        assert candidate.status == 'hired'
        assert candidate.employee_id is not None

    def test_hire_starts_default_onboarding(self):
        tenant = TenantFactory()
        doc_type = _doc_type()
        process = HiringProcessFactory(tenant=tenant)
        candidate = CandidateFactory(tenant=tenant, hiring_process=process)
        checklist = OnboardingChecklistFactory(tenant=tenant, is_default=True)
        OnboardingTaskFactory(tenant=tenant, checklist=checklist, title='Setup laptop')
        OnboardingTaskFactory(tenant=tenant, checklist=checklist, title='Sign NDA')

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/hiring/processes/{process.id}/candidates/{candidate.id}/hire/',
            {'document_type': doc_type.id, 'document_number': 5555555555},
            format='json',
        )

        assert response.status_code == 200
        emp = Employee.objects.get(id=response.json()['employee_id'])
        assert emp.onboarding.checklist == checklist
        assert emp.onboarding.completions.count() == 2

    def test_hire_already_hired_returns_400(self):
        tenant = TenantFactory()
        doc_type = _doc_type()
        process = HiringProcessFactory(tenant=tenant)
        candidate = CandidateFactory(tenant=tenant, hiring_process=process)
        url = f'/api/v1/hiring/processes/{process.id}/candidates/{candidate.id}/hire/'

        client = _client_for(tenant)
        client.post(url, {'document_type': doc_type.id, 'document_number': 1111111111}, format='json')
        response = client.post(url, {'document_type': doc_type.id, 'document_number': 2222222222}, format='json')

        assert response.status_code == 400

    def test_hire_fills_process_when_quota_met(self):
        tenant = TenantFactory()
        doc_type = _doc_type()
        process = HiringProcessFactory(tenant=tenant, positions_count=1)
        candidate = CandidateFactory(tenant=tenant, hiring_process=process)

        client = _client_for(tenant)
        client.post(
            f'/api/v1/hiring/processes/{process.id}/candidates/{candidate.id}/hire/',
            {'document_type': doc_type.id, 'document_number': 3333333333},
            format='json',
        )

        process.refresh_from_db()
        assert process.status == 'filled'


@pytest.mark.django_db
class TestNestedCandidateScoping:
    def test_candidate_detail_returns_404_under_wrong_process(self):
        tenant = TenantFactory()
        process_a = HiringProcessFactory(tenant=tenant)
        process_b = HiringProcessFactory(tenant=tenant)
        candidate_b = CandidateFactory(tenant=tenant, hiring_process=process_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/hiring/processes/{process_a.id}/candidates/{candidate_b.id}/'
        )
        assert response.status_code == 404

    def test_candidate_detail_accessible_under_correct_process(self):
        tenant = TenantFactory()
        process = HiringProcessFactory(tenant=tenant)
        candidate = CandidateFactory(tenant=tenant, hiring_process=process)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/hiring/processes/{process.id}/candidates/{candidate.id}/'
        )
        assert response.status_code == 200
        assert response.json()['id'] == str(candidate.id)

    def test_candidate_delete_via_nested_url(self):
        tenant = TenantFactory()
        process = HiringProcessFactory(tenant=tenant)
        candidate = CandidateFactory(tenant=tenant, hiring_process=process)

        client = _client_for(tenant)
        response = client.delete(
            f'/api/v1/hiring/processes/{process.id}/candidates/{candidate.id}/'
        )
        assert response.status_code == 204
        from apps.hiring.models import Candidate
        assert not Candidate.objects.filter(id=candidate.id).exists()


@pytest.mark.django_db
class TestOnboardingWorkflow:
    def test_checklist_task_list_via_action(self):
        tenant = TenantFactory()
        checklist = OnboardingChecklistFactory(tenant=tenant)
        OnboardingTaskFactory(tenant=tenant, checklist=checklist, title='Setup laptop')
        OnboardingTaskFactory(tenant=tenant, checklist=checklist, title='Sign NDA')

        client = _client_for(tenant)
        response = client.get(f'/api/v1/hiring/onboarding-checklists/{checklist.id}/tasks/')

        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_task_detail_nested_under_checklist(self):
        tenant = TenantFactory()
        checklist = OnboardingChecklistFactory(tenant=tenant)
        task = OnboardingTaskFactory(tenant=tenant, checklist=checklist)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/hiring/onboarding-checklists/{checklist.id}/tasks/{task.id}/'
        )
        assert response.status_code == 200
        assert response.json()['id'] == str(task.id)

    def test_task_detail_404_under_wrong_checklist(self):
        tenant = TenantFactory()
        checklist_a = OnboardingChecklistFactory(tenant=tenant)
        checklist_b = OnboardingChecklistFactory(tenant=tenant)
        task_b = OnboardingTaskFactory(tenant=tenant, checklist=checklist_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/hiring/onboarding-checklists/{checklist_a.id}/tasks/{task_b.id}/'
        )
        assert response.status_code == 404

    def test_employee_onboarding_list_via_personnel_url(self):
        tenant = TenantFactory()
        checklist = OnboardingChecklistFactory(tenant=tenant)
        onboarding = EmployeeOnboardingFactory(tenant=tenant, checklist=checklist)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/personnel/employees/{onboarding.employee.id}/onboarding/'
        )
        assert response.status_code == 200
        assert response.json()['count'] == 1

    def test_onboarding_create_via_personnel_url(self):
        tenant = TenantFactory()
        from apps.personnel.tests.factories import EmployeeFactory
        emp = EmployeeFactory(tenant=tenant)
        checklist = OnboardingChecklistFactory(tenant=tenant)
        OnboardingTaskFactory(tenant=tenant, checklist=checklist)

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/personnel/employees/{emp.id}/onboarding/',
            {'checklist': str(checklist.id), 'start_date': '2024-02-01'},
            format='json',
        )
        assert response.status_code == 201
        assert response.json()['employee'] == str(emp.id)
        # pre-created completion stub for the task
        from apps.hiring.models import EmployeeOnboarding
        ob = EmployeeOnboarding.objects.get(employee=emp)
        assert ob.completions.count() == 1

    def test_task_completion_list_via_personnel_url(self):
        tenant = TenantFactory()
        checklist = OnboardingChecklistFactory(tenant=tenant)
        task = OnboardingTaskFactory(tenant=tenant, checklist=checklist)
        onboarding = EmployeeOnboardingFactory(tenant=tenant, checklist=checklist)
        OnboardingTaskCompletion.objects.create(
            tenant=tenant, onboarding=onboarding, task=task,
        )

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/personnel/employees/{onboarding.employee.id}/onboarding/{onboarding.id}/task-completions/'
        )
        assert response.status_code == 200
        assert response.json()['count'] == 1

    def test_complete_task_via_hiring_url(self):
        tenant = TenantFactory()
        checklist = OnboardingChecklistFactory(tenant=tenant)
        task = OnboardingTaskFactory(tenant=tenant, checklist=checklist)
        onboarding = EmployeeOnboardingFactory(tenant=tenant, checklist=checklist)
        completion = OnboardingTaskCompletion.objects.create(
            tenant=tenant, onboarding=onboarding, task=task,
        )

        client = _client_for(tenant)
        response = client.patch(
            f'/api/v1/hiring/onboardings/{onboarding.id}/tasks/{task.id}/complete/',
            {'completed_by': 'HR Admin', 'notes': 'Done on time'},
            format='json',
        )
        assert response.status_code == 200
        completion.refresh_from_db()
        assert completion.completed_at is not None
        assert completion.completed_by == 'HR Admin'

    def test_complete_all_tasks_marks_onboarding_complete(self):
        tenant = TenantFactory()
        checklist = OnboardingChecklistFactory(tenant=tenant)
        task = OnboardingTaskFactory(tenant=tenant, checklist=checklist)
        onboarding = EmployeeOnboardingFactory(tenant=tenant, checklist=checklist)
        OnboardingTaskCompletion.objects.create(
            tenant=tenant, onboarding=onboarding, task=task,
        )

        client = _client_for(tenant)
        client.patch(
            f'/api/v1/hiring/onboardings/{onboarding.id}/tasks/{task.id}/complete/',
            {'completed_by': 'HR', 'notes': ''},
            format='json',
        )

        onboarding.refresh_from_db()
        assert onboarding.status == 'completed'
        assert onboarding.completed_at is not None
