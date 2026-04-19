from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import TimestampedTenantModel
from apps.core.managers import TenantManager


class HiringProcess(TimestampedTenantModel):
    """A hiring process for a specific position."""
    position_title = models.CharField(max_length=255)
    department = models.ForeignKey(
        'personnel.Department',
        on_delete=models.PROTECT,
        null=True, blank=True,
    )
    requested_by = models.CharField(max_length=255)
    status = models.CharField(max_length=30, choices=[
        ('open', _('Open')),
        ('in_progress', _('In Progress')),
        ('filled', _('Filled')),
        ('cancelled', _('Cancelled')),
    ], default='open')
    positions_count = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)
    objects = TenantManager()

    class Meta:
        db_table = 'hiring_process'
        verbose_name = _('hiring process')
        verbose_name_plural = _('hiring processes')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.position_title} ({self.get_status_display()})'

    @property
    def hired_count(self):
        return self.candidates.filter(status='hired').count()


class Candidate(TimestampedTenantModel):
    """A person being considered for a hiring process."""
    hiring_process = models.ForeignKey(
        HiringProcess, on_delete=models.CASCADE, related_name='candidates',
    )
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    resume = models.FileField(upload_to='hiring/resumes/', blank=True)
    status = models.CharField(max_length=30, choices=[
        ('applied', _('Applied')),
        ('screening', _('Screening')),
        ('interview', _('Interview')),
        ('offer', _('Offer')),
        ('hired', _('Hired')),
        ('rejected', _('Rejected')),
    ], default='applied')
    notes = models.TextField(blank=True)
    # Set when candidate is hired — links to the created Employee
    employee = models.OneToOneField(
        'personnel.Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='from_candidate',
    )
    objects = TenantManager()

    class Meta:
        db_table = 'hiring_candidate'
        verbose_name = _('candidate')
        verbose_name_plural = _('candidates')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} — {self.get_status_display()}'


class OnboardingChecklist(TimestampedTenantModel):
    """Template checklist reusable across new-hire onboardings."""
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    objects = TenantManager()

    class Meta:
        db_table = 'hiring_onboarding_checklist'
        verbose_name = _('onboarding checklist')
        verbose_name_plural = _('onboarding checklists')
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_default:
            # Enforce at most one default per tenant
            OnboardingChecklist.objects.filter(
                tenant=self.tenant, is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class OnboardingTask(TimestampedTenantModel):
    """A single task within an OnboardingChecklist template."""
    checklist = models.ForeignKey(
        OnboardingChecklist, on_delete=models.CASCADE, related_name='tasks',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    responsible_role = models.CharField(max_length=100, blank=True)
    order = models.PositiveIntegerField(default=0)
    days_to_complete = models.PositiveIntegerField(default=7)
    objects = TenantManager()

    class Meta:
        db_table = 'hiring_onboarding_task'
        verbose_name = _('onboarding task')
        verbose_name_plural = _('onboarding tasks')
        ordering = ['order']

    def __str__(self):
        return f'{self.checklist.name} › {self.title}'


class EmployeeOnboarding(TimestampedTenantModel):
    """Tracks a specific employee's onboarding progress."""
    employee = models.OneToOneField(
        'personnel.Employee', on_delete=models.CASCADE, related_name='onboarding',
    )
    checklist = models.ForeignKey(OnboardingChecklist, on_delete=models.PROTECT)
    start_date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('in_progress', _('In Progress')),
        ('completed', _('Completed')),
    ], default='in_progress')
    objects = TenantManager()

    class Meta:
        db_table = 'hiring_employee_onboarding'
        verbose_name = _('employee onboarding')
        verbose_name_plural = _('employee onboardings')
        ordering = ['-start_date']

    def __str__(self):
        return f'{self.employee.full_name} onboarding ({self.status})'

    @property
    def progress_percentage(self):
        total = self.checklist.tasks.count()
        if not total:
            return 100
        done = self.completions.filter(completed_at__isnull=False).count()
        return round(done / total * 100)


class OnboardingTaskCompletion(TimestampedTenantModel):
    """Tracks completion of one task within an EmployeeOnboarding."""
    onboarding = models.ForeignKey(
        EmployeeOnboarding, on_delete=models.CASCADE, related_name='completions',
    )
    task = models.ForeignKey(OnboardingTask, on_delete=models.CASCADE)
    completed_by = models.CharField(max_length=255, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    objects = TenantManager()

    class Meta:
        db_table = 'hiring_task_completion'
        verbose_name = _('task completion')
        unique_together = [('onboarding', 'task')]
        ordering = ['task__order']

    def __str__(self):
        done = '✓' if self.completed_at else '○'
        return f'{done} {self.task.title}'
