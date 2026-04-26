import logging

logger = logging.getLogger('integrations.tasks')

try:
    from celery import shared_task

    @shared_task(
        bind=True,
        max_retries=3,
        default_retry_delay=30,
        name='integrations.process_webhook',
    )
    def process_webhook_task(self, payload):
        try:
            from apps.integrations.webhook_receiver import _process_webhook_sync
            _process_webhook_sync(payload)
        except Exception as exc:
            logger.error(f'Error en webhook task: {exc}')
            raise self.retry(exc=exc)

    @shared_task(name='integrations.sync_tenant')
    def sync_tenant_task(tenant_id):
        from apps.core.models import Tenant
        from apps.integrations.sync_service import NomiwebSyncService
        try:
            tenant = Tenant.objects.get(id=tenant_id)
            service = NomiwebSyncService()
            return service.full_sync_tenant(tenant)
        except Exception as e:
            logger.error(f'Error sync tenant {tenant_id}: {e}')
            raise

except ImportError:
    logger.info('Celery no disponible — tasks en modo síncrono')

    def process_webhook_task(payload):
        from apps.integrations.webhook_receiver import _process_webhook_sync
        _process_webhook_sync(payload)
    process_webhook_task.delay = process_webhook_task

    def sync_tenant_task(tenant_id):
        from apps.core.models import Tenant
        from apps.integrations.sync_service import NomiwebSyncService
        tenant = Tenant.objects.get(id=tenant_id)
        service = NomiwebSyncService()
        return service.full_sync_tenant(tenant)
    sync_tenant_task.delay = sync_tenant_task
