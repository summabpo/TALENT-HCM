from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import TimestampedTenantModel
from apps.core.managers import TenantManager


class QualityProcess(TimestampedTenantModel):
    """A documented process within the QMS (e.g. PR-RH-001)."""
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='owned_processes',
    )
    department = models.ForeignKey(
        'personnel.Department',
        on_delete=models.PROTECT,
        null=True, blank=True,
    )
    version = models.CharField(max_length=20, default='1.0')
    status = models.CharField(max_length=20, choices=[
        ('draft', _('Draft')),
        ('active', _('Active')),
        ('under_review', _('Under Review')),
        ('obsolete', _('Obsolete')),
    ], default='draft')
    effective_date = models.DateField(null=True, blank=True)
    review_date = models.DateField(null=True, blank=True)
    objects = TenantManager()

    class Meta:
        db_table = 'quality_process'
        verbose_name = _('quality process')
        verbose_name_plural = _('quality processes')
        ordering = ['code']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f'{self.code} — {self.name}'


class QualityDocument(TimestampedTenantModel):
    """Controlled document: procedure, work instruction, format, record, policy, manual."""
    process = models.ForeignKey(
        QualityProcess,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='documents',
    )
    code = models.CharField(max_length=30)
    title = models.CharField(max_length=255)
    document_type = models.CharField(max_length=30, choices=[
        ('procedure', _('Procedimiento')),
        ('instruction', _('Instrucción de Trabajo')),
        ('format', _('Formato')),
        ('record', _('Registro')),
        ('policy', _('Política')),
        ('manual', _('Manual')),
    ])
    version = models.CharField(max_length=20, default='1.0')
    file = models.FileField(upload_to='quality/documents/')
    status = models.CharField(max_length=20, choices=[
        ('draft', _('Draft')),
        ('approved', _('Approved')),
        ('obsolete', _('Obsolete')),
    ], default='draft')
    approved_by = models.CharField(max_length=255, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    effective_date = models.DateField(null=True, blank=True)
    objects = TenantManager()

    class Meta:
        db_table = 'quality_document'
        verbose_name = _('quality document')
        verbose_name_plural = _('quality documents')
        ordering = ['code']
        unique_together = [('tenant', 'code', 'version')]

    def __str__(self):
        return f'{self.code} v{self.version} — {self.title}'


class InternalAudit(TimestampedTenantModel):
    """Internal audit per ISO 9001 clause 9.2."""
    code = models.CharField(max_length=20)
    process = models.ForeignKey(
        QualityProcess,
        on_delete=models.PROTECT,
        related_name='audits',
    )
    auditor = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        related_name='audits_led',
    )
    planned_date = models.DateField()
    executed_date = models.DateField(null=True, blank=True)
    scope = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[
        ('planned', _('Planned')),
        ('in_progress', _('In Progress')),
        ('completed', _('Completed')),
        ('cancelled', _('Cancelled')),
    ], default='planned')
    conclusions = models.TextField(blank=True)
    objects = TenantManager()

    class Meta:
        db_table = 'quality_audit'
        verbose_name = _('internal audit')
        verbose_name_plural = _('internal audits')
        ordering = ['-planned_date']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f'{self.code} — {self.process.code} ({self.get_status_display()})'


class AuditFinding(TimestampedTenantModel):
    """A finding recorded during an internal audit."""
    audit = models.ForeignKey(
        InternalAudit,
        on_delete=models.CASCADE,
        related_name='findings',
    )
    finding_type = models.CharField(max_length=30, choices=[
        ('nonconformity_major', _('No Conformidad Mayor')),
        ('nonconformity_minor', _('No Conformidad Menor')),
        ('observation', _('Observación')),
        ('opportunity', _('Oportunidad de Mejora')),
    ])
    clause = models.CharField(max_length=20, blank=True)   # ISO 9001 clause, e.g. "7.1.5"
    description = models.TextField()
    evidence = models.TextField(blank=True)
    objects = TenantManager()

    class Meta:
        db_table = 'quality_audit_finding'
        verbose_name = _('audit finding')
        verbose_name_plural = _('audit findings')
        ordering = ['finding_type']

    def __str__(self):
        return f'{self.get_finding_type_display()} — {self.audit.code}'


class NonConformity(TimestampedTenantModel):
    """Nonconformity + CAPA (Corrective and Preventive Action). ISO 9001 clause 10.2."""
    code = models.CharField(max_length=20)
    source = models.CharField(max_length=30, choices=[
        ('audit', _('Auditoría Interna')),
        ('external_audit', _('Auditoría Externa')),
        ('customer_complaint', _('Queja de Cliente')),
        ('process', _('Detección en Proceso')),
        ('employee', _('Reporte de Empleado')),
    ])
    audit_finding = models.ForeignKey(
        AuditFinding,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='nonconformities',
    )
    description = models.TextField()
    root_cause = models.TextField(blank=True)
    immediate_action = models.TextField(blank=True)
    corrective_action = models.TextField(blank=True)
    preventive_action = models.TextField(blank=True)
    responsible = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='nonconformities_responsible',
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('open', _('Open')),
        ('in_progress', _('In Progress')),
        ('verification', _('Verification')),
        ('closed', _('Closed')),
    ], default='open')
    closed_at = models.DateTimeField(null=True, blank=True)
    effectiveness_verified = models.BooleanField(default=False)
    objects = TenantManager()

    class Meta:
        db_table = 'quality_nonconformity'
        verbose_name = _('nonconformity')
        verbose_name_plural = _('nonconformities')
        ordering = ['-created_at']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f'{self.code} — {self.get_status_display()}'


class ContinuousImprovement(TimestampedTenantModel):
    """Improvement action register. ISO 9001 clause 10.3."""
    code = models.CharField(max_length=20)
    title = models.CharField(max_length=255)
    description = models.TextField()
    process = models.ForeignKey(
        QualityProcess,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='improvements',
    )
    proposed_by = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        related_name='improvements_proposed',
    )
    responsible = models.ForeignKey(
        'personnel.Employee',
        on_delete=models.PROTECT,
        related_name='improvements_assigned',
    )
    expected_benefit = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[
        ('proposed', _('Proposed')),
        ('approved', _('Approved')),
        ('in_progress', _('In Progress')),
        ('completed', _('Completed')),
        ('rejected', _('Rejected')),
    ], default='proposed')
    priority = models.CharField(max_length=10, choices=[
        ('low', _('Low')),
        ('medium', _('Medium')),
        ('high', _('High')),
    ], default='medium')
    due_date = models.DateField(null=True, blank=True)
    result = models.TextField(blank=True)
    objects = TenantManager()

    class Meta:
        db_table = 'quality_improvement'
        verbose_name = _('continuous improvement')
        verbose_name_plural = _('continuous improvements')
        ordering = ['-created_at']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f'{self.code} — {self.title}'
