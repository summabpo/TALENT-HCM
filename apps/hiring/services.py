"""
Business logic for the hiring module.
Kept separate from views so it can be called from signals or management commands.
"""
from django.utils import timezone
from apps.personnel.models import Employee


def hire_candidate(candidate, document_type_id, document_number, request_user='system'):
    """
    Transition a candidate to 'hired' and create the corresponding Employee record.

    Returns the newly created Employee.
    Raises ValueError if the candidate is already hired or in a terminal state.
    """
    if candidate.status == 'hired':
        raise ValueError('Candidate is already hired.')
    if candidate.status == 'rejected':
        raise ValueError('Cannot hire a rejected candidate.')

    tenant = candidate.tenant
    process = candidate.hiring_process

    # Split full_name into parts best-effort
    name_parts = candidate.full_name.strip().split()
    first_name = name_parts[0] if name_parts else candidate.full_name
    first_last_name = name_parts[-1] if len(name_parts) > 1 else ''

    employee = Employee.objects.create(
        tenant=tenant,
        document_type_id=document_type_id,
        document_number=document_number,
        first_name=first_name,
        first_last_name=first_last_name,
        email=candidate.email,
        phone=candidate.phone,
        department=process.department,
        status='active',
    )

    candidate.status = 'hired'
    candidate.employee = employee
    candidate._changed_by = str(request_user)
    candidate.save(update_fields=['status', 'employee', 'updated_at'])

    # If the process is now fully filled, mark it so
    if process.hired_count >= process.positions_count:
        process.status = 'filled'
        process.save(update_fields=['status', 'updated_at'])

    # Start onboarding with the tenant's default checklist, if one exists
    from apps.hiring.models import OnboardingChecklist, EmployeeOnboarding, OnboardingTaskCompletion
    default_checklist = OnboardingChecklist.objects.filter(
        tenant=tenant, is_default=True,
    ).first()
    if default_checklist:
        onboarding = EmployeeOnboarding.objects.create(
            tenant=tenant,
            employee=employee,
            checklist=default_checklist,
            start_date=timezone.now().date(),
        )
        # Pre-create completion rows (uncompleted) for every task
        completions = [
            OnboardingTaskCompletion(
                tenant=tenant,
                onboarding=onboarding,
                task=task,
            )
            for task in default_checklist.tasks.all()
        ]
        OnboardingTaskCompletion.objects.bulk_create(completions)

    return employee
