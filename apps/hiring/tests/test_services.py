import pytest
from apps.personnel.tests.factories import TenantFactory, EmployeeFactory, DepartmentFactory, DocumentTypeFactory
from apps.hiring.models import HiringProcess, Candidate, OnboardingChecklist


@pytest.fixture
def hiring_setup(db):
    tenant = TenantFactory()
    dept = DepartmentFactory(tenant=tenant)
    doc_type = DocumentTypeFactory()
    process = HiringProcess.objects.create(
        tenant=tenant,
        position_title='Software Engineer',
        department=dept,
        requested_by='HR',
        positions_count=1,
    )
    candidate = Candidate.objects.create(
        tenant=tenant,
        hiring_process=process,
        full_name='María López',
        email='maria@example.com',
        phone='3001234567',
    )
    return tenant, dept, doc_type, process, candidate


@pytest.mark.django_db
class TestHireCandidate:
    def test_hire_creates_employee(self, hiring_setup):
        from apps.hiring.services import hire_candidate
        tenant, dept, doc_type, process, candidate = hiring_setup

        employee = hire_candidate(candidate, doc_type.id, 123456789)

        assert employee is not None
        assert employee.first_name == 'María'
        assert employee.first_last_name == 'López'
        assert employee.email == 'maria@example.com'
        assert employee.tenant == tenant

    def test_hire_marks_candidate_hired(self, hiring_setup):
        from apps.hiring.services import hire_candidate
        tenant, dept, doc_type, process, candidate = hiring_setup

        hire_candidate(candidate, doc_type.id, 123456789)

        candidate.refresh_from_db()
        assert candidate.status == 'hired'
        assert candidate.employee is not None

    def test_hire_fills_process_when_quota_met(self, hiring_setup):
        from apps.hiring.services import hire_candidate
        tenant, dept, doc_type, process, candidate = hiring_setup

        hire_candidate(candidate, doc_type.id, 123456789)

        process.refresh_from_db()
        assert process.status == 'filled'

    def test_hire_raises_if_already_hired(self, hiring_setup):
        from apps.hiring.services import hire_candidate
        from rest_framework.exceptions import ValidationError
        tenant, dept, doc_type, process, candidate = hiring_setup

        hire_candidate(candidate, doc_type.id, 123456789)

        candidate.refresh_from_db()
        with pytest.raises((ValidationError, Exception)):
            hire_candidate(candidate, doc_type.id, 987654321)

    def test_hire_starts_default_onboarding(self, hiring_setup):
        from apps.hiring.services import hire_candidate
        from apps.hiring.models import OnboardingChecklist, EmployeeOnboarding
        tenant, dept, doc_type, process, candidate = hiring_setup

        checklist = OnboardingChecklist.objects.create(
            tenant=tenant, name='Default', is_default=True,
        )

        employee = hire_candidate(candidate, doc_type.id, 111222333)

        assert EmployeeOnboarding.objects.filter(employee=employee, checklist=checklist).exists()
