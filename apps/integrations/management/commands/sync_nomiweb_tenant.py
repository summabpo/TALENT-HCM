from django.core.management.base import BaseCommand
from apps.core.models import Tenant
from apps.integrations.models import NomiwebConfig
from apps.integrations.sync_service import NomiwebSyncService


class Command(BaseCommand):
    help = 'Sincroniza uno o todos los tenants desde Nomiweb'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant', type=str,
            help='Slug o UUID del tenant a sincronizar',
        )
        parser.add_argument(
            '--empresa-id', type=int,
            help='ID de empresa en Nomiweb (crea config si no existe)',
        )
        parser.add_argument(
            '--all', action='store_true',
            help='Sincronizar todos los tenants con config activa',
        )

    def handle(self, *args, **options):
        service = NomiwebSyncService()

        if options['all']:
            configs = NomiwebConfig.objects.filter(
                sync_enabled=True
            ).select_related('tenant')
            self.stdout.write(f'Sincronizando {configs.count()} tenants...')
            for config in configs:
                self._sync_one(service, config.tenant)
            return

        tenant_arg = options.get('tenant')
        empresa_id = options.get('empresa_id')

        if not tenant_arg:
            self.stderr.write('Especifica --tenant <slug|uuid> o --all')
            return

        try:
            tenant = Tenant.objects.get(slug=tenant_arg)
        except Tenant.DoesNotExist:
            try:
                tenant = Tenant.objects.get(id=tenant_arg)
            except Tenant.DoesNotExist:
                self.stderr.write(f'Tenant no encontrado: {tenant_arg}')
                return

        if empresa_id:
            config, created = NomiwebConfig.objects.get_or_create(
                tenant=tenant,
                defaults={'nomiweb_empresa_id': empresa_id, 'sync_enabled': True},
            )
            if created:
                self.stdout.write(
                    f'Config creada: tenant={tenant.slug} empresa_id={empresa_id}'
                )
            elif config.nomiweb_empresa_id != empresa_id:
                config.nomiweb_empresa_id = empresa_id
                config.save(update_fields=['nomiweb_empresa_id'])

        self._sync_one(service, tenant)

    def _sync_one(self, service, tenant):
        self.stdout.write(f'Sincronizando {tenant.name}...')
        try:
            stats = service.full_sync_tenant(tenant)
            self.stdout.write(self.style.SUCCESS(f'  {tenant.name}: {stats}'))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'  {tenant.name}: {e}'))
