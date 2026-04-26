from django.db import models
import uuid


class NomiwebConfig(models.Model):
    """Configuración de integración Nomiweb por tenant."""
    tenant = models.OneToOneField(
        'core.Tenant',
        on_delete=models.CASCADE,
        related_name='nomiweb_config'
    )
    nomiweb_empresa_id = models.IntegerField(
        help_text='ID de la empresa en Nomiweb (empresa.idempresa)'
    )
    sync_enabled = models.BooleanField(
        default=True,
        help_text='Si False, los webhooks se ignoran para este tenant'
    )
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(
        max_length=20,
        choices=[
            ('success', 'Exitosa'),
            ('partial', 'Parcial'),
            ('error', 'Error'),
            ('never', 'Nunca sincronizado'),
        ],
        default='never'
    )
    sync_interval_minutes = models.IntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuración Nomiweb'
        verbose_name_plural = 'Configuraciones Nomiweb'

    def __str__(self):
        return f'{self.tenant.name} ↔ Nomiweb #{self.nomiweb_empresa_id}'


class SyncLog(models.Model):
    """Registro de cada operación de sincronización."""
    DIRECTION = [
        ('nomiweb_to_hcm', 'Nomiweb → HCM'),
        ('hcm_to_nomiweb', 'HCM → Nomiweb'),
    ]
    STATUS = [
        ('success', 'Exitoso'),
        ('error', 'Error'),
        ('skipped', 'Omitido'),
    ]
    MODEL_CHOICES = [
        ('tenant', 'Empresa/Tenant'),
        ('employee', 'Empleado'),
        ('contract', 'Contrato'),
        ('position', 'Cargo'),
        ('cost_center', 'Centro de Costo'),
        ('work_location', 'Sede'),
        ('nomina', 'Nómina'),
        ('vacacion', 'Vacación'),
        ('liquidacion', 'Liquidación'),
        ('catalog', 'Catálogo global'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'core.Tenant',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='sync_logs'
    )
    direction = models.CharField(max_length=20, choices=DIRECTION)
    model_name = models.CharField(max_length=30, choices=MODEL_CHOICES)
    nomiweb_id = models.CharField(max_length=50, blank=True)
    hcm_id = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS)
    action = models.CharField(
        max_length=20,
        choices=[
            ('created', 'Creado'),
            ('updated', 'Actualizado'),
            ('skipped', 'Sin cambios'),
        ],
        blank=True
    )
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Log de Sincronización'
        verbose_name_plural = 'Logs de Sincronización'

    def __str__(self):
        return f'{self.direction} | {self.model_name} #{self.nomiweb_id} | {self.status}'
