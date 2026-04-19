from django.db.models.signals import pre_save
from django.dispatch import receiver

# Fields to track in EmployeeHistory on every save
TRACKED_FIELDS = [
    'status', 'department_id', 'direct_manager_id',
    'email', 'phone', 'cell_phone', 'address',
    'employee_number',
]


@receiver(pre_save, sender='personnel.Employee')
def track_employee_changes(sender, instance, **kwargs):
    if not instance.pk:
        return  # new record — no history yet

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    changed_by = getattr(instance, '_changed_by', 'system')

    from apps.personnel.models import EmployeeHistory

    for field in TRACKED_FIELDS:
        old_val = str(getattr(old, field, '') or '')
        new_val = str(getattr(instance, field, '') or '')
        if old_val != new_val:
            change_type = _infer_change_type(field)
            EmployeeHistory.objects.create(
                tenant=instance.tenant,
                employee=instance,
                change_type=change_type,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
                changed_by=changed_by,
            )


def _infer_change_type(field: str) -> str:
    if field == 'status':
        return 'status_change'
    if field == 'department_id':
        return 'transfer'
    if field == 'direct_manager_id':
        return 'reporting_change'
    return 'update'
