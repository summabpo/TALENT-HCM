from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import TimestampedTenantModel
from apps.core.managers import TenantManager


class OKRPeriod(TimestampedTenantModel):
    """A named evaluation period (e.g. Q1 2026, H1 2026)."""
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)
    objects = TenantManager()

    class Meta:
        db_table = 'performance_okr_period'
        verbose_name = _('OKR period')
        verbose_name_plural = _('OKR periods')
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_active:
            OKRPeriod.objects.filter(
                tenant=self.tenant, is_active=True,
            ).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class Objective(TimestampedTenantModel):
    """The O in OKR — company, department, or individual level."""
    LEVEL_CHOICES = [
        ('company', _('Company')),
        ('department', _('Department')),
        ('individual', _('Individual')),
    ]
    period = models.ForeignKey(OKRPeriod, on_delete=models.CASCADE, related_name='objectives')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    department = models.ForeignKey(
        'personnel.Department',
        on_delete=models.PROTECT,
        null=True, blank=True,
    )
    owner = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='owned_objectives',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='children',
    )
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    status = models.CharField(max_length=20, choices=[
        ('draft', _('Draft')),
        ('active', _('Active')),
        ('completed', _('Completed')),
        ('cancelled', _('Cancelled')),
    ], default='draft')
    objects = TenantManager()

    class Meta:
        db_table = 'performance_objective'
        verbose_name = _('objective')
        verbose_name_plural = _('objectives')
        ordering = ['period', 'level', 'title']

    def __str__(self):
        return self.title

    @property
    def progress_percentage(self):
        krs = self.key_results.all()
        if not krs:
            return 0
        total_weight = sum(float(kr.weight) for kr in krs)
        if not total_weight:
            return 0
        weighted = sum(float(kr.weight) * kr.progress_percentage for kr in krs)
        return round(weighted / total_weight, 1)


class KeyResult(TimestampedTenantModel):
    """The KR in OKR — a measurable outcome tied to an Objective."""
    objective = models.ForeignKey(Objective, on_delete=models.CASCADE, related_name='key_results')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    metric_type = models.CharField(max_length=20, choices=[
        ('number', _('Number')),
        ('percentage', _('Percentage')),
        ('currency', _('Currency')),
        ('boolean', _('Yes/No')),
    ], default='number')
    target_value = models.DecimalField(max_digits=12, decimal_places=2)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    start_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    responsible = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='key_results_responsible',
    )
    objects = TenantManager()

    class Meta:
        db_table = 'performance_key_result'
        verbose_name = _('key result')
        verbose_name_plural = _('key results')
        ordering = ['objective', 'title']

    def __str__(self):
        return f'{self.objective.title} › {self.title}'

    @property
    def progress_percentage(self):
        span = float(self.target_value) - float(self.start_value)
        if span == 0:
            return 100.0
        progress = float(self.current_value) - float(self.start_value)
        return round(min(max(progress / span * 100, 0), 100), 1)


class KeyResultUpdate(TimestampedTenantModel):
    """A check-in / progress update on a Key Result."""
    key_result = models.ForeignKey(KeyResult, on_delete=models.CASCADE, related_name='updates')
    previous_value = models.DecimalField(max_digits=12, decimal_places=2)
    new_value = models.DecimalField(max_digits=12, decimal_places=2)
    comment = models.TextField(blank=True)
    updated_by = models.CharField(max_length=255)
    objects = TenantManager()

    class Meta:
        db_table = 'performance_kr_update'
        verbose_name = _('key result update')
        verbose_name_plural = _('key result updates')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.key_result.title}: {self.previous_value} → {self.new_value}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Keep KeyResult.current_value in sync with the latest update
        self.key_result.current_value = self.new_value
        self.key_result.save(update_fields=['current_value', 'updated_at'])


class KPI(TimestampedTenantModel):
    """
    Standalone KPI — tracked independently of OKRs,
    but can be linked to a Quality process for ISO 9001 metrics.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    department = models.ForeignKey(
        'personnel.Department',
        on_delete=models.PROTECT,
        null=True, blank=True,
    )
    owner = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='owned_kpis',
    )
    quality_process = models.ForeignKey(
        'quality.QualityProcess',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='kpis',
    )
    metric_type = models.CharField(max_length=20, choices=[
        ('number', _('Number')),
        ('percentage', _('Percentage')),
        ('currency', _('Currency')),
    ], default='number')
    unit = models.CharField(max_length=20, blank=True)
    target_value = models.DecimalField(max_digits=12, decimal_places=2)
    frequency = models.CharField(max_length=20, choices=[
        ('daily', _('Daily')),
        ('weekly', _('Weekly')),
        ('monthly', _('Monthly')),
        ('quarterly', _('Quarterly')),
        ('yearly', _('Yearly')),
    ], default='monthly')
    is_active = models.BooleanField(default=True)
    objects = TenantManager()

    class Meta:
        db_table = 'performance_kpi'
        verbose_name = 'KPI'
        verbose_name_plural = 'KPIs'
        ordering = ['name']

    def __str__(self):
        return self.name


class KPIMeasurement(TimestampedTenantModel):
    """A single measurement / data point for a KPI."""
    kpi = models.ForeignKey(KPI, on_delete=models.CASCADE, related_name='measurements')
    period_label = models.CharField(max_length=50)   # e.g. "Enero 2026", "Q1 2026"
    period_date = models.DateField()                  # first day of period — used for ordering
    value = models.DecimalField(max_digits=12, decimal_places=2)
    comment = models.TextField(blank=True)
    recorded_by = models.CharField(max_length=255)
    objects = TenantManager()

    class Meta:
        db_table = 'performance_kpi_measurement'
        verbose_name = _('KPI measurement')
        verbose_name_plural = _('KPI measurements')
        ordering = ['-period_date']
        unique_together = [('kpi', 'period_date')]

    def __str__(self):
        return f'{self.kpi.name} — {self.period_label}: {self.value}'
