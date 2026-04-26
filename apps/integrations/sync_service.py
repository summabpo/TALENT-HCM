import logging
from django.utils import timezone
from apps.integrations.nomiweb_client import NomiwebClient, NomiwebAPIError
from apps.integrations.mapper import NomiwebMapper
from apps.integrations.models import NomiwebConfig, SyncLog
from apps.catalogs.models import Position, CostCenter, WorkLocation, WorkCenter, OrganizationalLevel

logger = logging.getLogger('integrations.sync')

# Required fields on Employee that must be present for create
_EMPLOYEE_REQUIRED = {'document_type', 'document_number', 'first_name', 'first_last_name'}

# Required fields on Contract for create
_CONTRACT_REQUIRED = {'start_date', 'position', 'work_center', 'eps', 'ccf', 'contributor_type'}


class NomiwebSyncService:
    """Orquesta la sincronización de datos entre Nomiweb y HCM (idempotente)."""

    def __init__(self):
        self.client = NomiwebClient()
        self.mapper = NomiwebMapper()

    def _log(self, tenant, direction, model_name, nomiweb_id,
             hcm_id=None, status='success', action='', error=''):
        SyncLog.objects.create(
            tenant=tenant,
            direction=direction,
            model_name=model_name,
            nomiweb_id=str(nomiweb_id) if nomiweb_id else '',
            hcm_id=str(hcm_id) if hcm_id else '',
            status=status,
            action=action,
            error_message=error,
        )

    # ── Empresa → Tenant ──────────────────────────────────────

    def sync_tenant_from_empresa(self, tenant, empresa_data):
        """Actualiza datos del Tenant desde Empresa de Nomiweb."""
        try:
            data = self.mapper.empresa_to_tenant(empresa_data, tenant)
            for field, value in data.items():
                if field not in ('nomiweb_empresa_id', 'tenant'):
                    setattr(tenant, field, value)
            tenant.save()
            self._log(tenant, 'nomiweb_to_hcm', 'tenant',
                      empresa_data.get('idempresa'), tenant.id,
                      'success', 'updated')
            return tenant
        except Exception as e:
            self._log(tenant, 'nomiweb_to_hcm', 'tenant',
                      empresa_data.get('idempresa'), status='error', error=str(e))
            logger.error(f'Error sync tenant {tenant.id}: {e}')
            raise

    # ── Catálogos por empresa ──────────────────────────────────

    def sync_catalogs_for_tenant(self, tenant, empresa_id):
        """Sincroniza catálogos por empresa: cargos, costos, sedes, centros de trabajo."""
        stats = {'positions': 0, 'cost_centers': 0, 'work_locations': 0, 'work_centers': 0}

        # Cargos → Positions
        # Position requires 'level' FK (OrganizationalLevel) — get or create a default one
        try:
            cargos = self.client.get_cargos(empresa_id)
            if cargos:
                default_level, _ = OrganizationalLevel.objects.get_or_create(
                    tenant=tenant,
                    name='Nomiweb',
                )
                for cargo in cargos:
                    data = self.mapper.cargo_to_position(cargo, tenant)
                    if not data.get('name') or not data.get('nomiweb_cargo_id'):
                        continue
                    obj, created = Position.objects.update_or_create(
                        tenant=tenant,
                        nomiweb_cargo_id=data['nomiweb_cargo_id'],
                        defaults={'name': data['name'], 'level': default_level},
                    )
                    stats['positions'] += 1
                    self._log(tenant, 'nomiweb_to_hcm', 'position',
                               data['nomiweb_cargo_id'], obj.id, 'success',
                               'created' if created else 'updated')
        except NomiwebAPIError as e:
            logger.warning(f'Error sync cargos tenant {tenant.id}: {e}')

        # Costos → CostCenters
        try:
            costos = self.client.get_costos(empresa_id)
            for costo in costos:
                data = self.mapper.costo_to_cost_center(costo, tenant)
                if not data.get('name'):
                    continue
                obj, created = CostCenter.objects.update_or_create(
                    tenant=tenant,
                    nomiweb_costo_id=costo.get('idcosto'),
                    defaults={'name': data['name']},
                )
                stats['cost_centers'] += 1
                self._log(tenant, 'nomiweb_to_hcm', 'cost_center',
                           costo.get('idcosto'), obj.id, 'success',
                           'created' if created else 'updated')
        except NomiwebAPIError as e:
            logger.warning(f'Error sync costos tenant {tenant.id}: {e}')

        # Sedes → WorkLocations
        try:
            sedes = self.client.get_sedes(empresa_id)
            for sede in sedes:
                data = self.mapper.sede_to_work_location(sede, tenant)
                if not data.get('name'):
                    continue
                obj, created = WorkLocation.objects.update_or_create(
                    tenant=tenant,
                    nomiweb_sede_id=sede.get('idsede'),
                    defaults={'name': data['name']},
                )
                stats['work_locations'] += 1
                self._log(tenant, 'nomiweb_to_hcm', 'work_location',
                           sede.get('idsede'), obj.id, 'success',
                           'created' if created else 'updated')
        except NomiwebAPIError as e:
            logger.warning(f'Error sync sedes tenant {tenant.id}: {e}')

        # Centros de trabajo → WorkCenters
        try:
            centros = self.client.get_centros_trabajo(empresa_id)
            for ct in centros:
                data = self.mapper.centrotrabajo_to_work_center(ct, tenant)
                if not data.get('name') or not data.get('nomiweb_ct_id'):
                    continue
                obj, created = WorkCenter.objects.update_or_create(
                    tenant=tenant,
                    nomiweb_ct_id=data['nomiweb_ct_id'],
                    defaults={
                        'name': data['name'],
                        'arl_rate': data.get('arl_rate') or 0,
                    },
                )
                stats['work_centers'] += 1
                self._log(tenant, 'nomiweb_to_hcm', 'work_location',
                           data['nomiweb_ct_id'], obj.id, 'success',
                           'created' if created else 'updated')
        except NomiwebAPIError as e:
            logger.warning(f'Error sync centros trabajo tenant {tenant.id}: {e}')

        return stats

    # ── Empleados y contratos ──────────────────────────────────

    def sync_employees_for_tenant(self, tenant, empresa_id):
        """Sincroniza empleados y sus contratos."""
        from apps.personnel.models import Employee, Contract

        stats = {'employees': 0, 'contracts': 0, 'created': 0, 'updated': 0,
                 'skipped': 0, 'errors': 0}

        try:
            empleados = self.client.get_empleados(empresa_id)
        except NomiwebAPIError as e:
            logger.error(f'Error obteniendo empleados empresa {empresa_id}: {e}')
            return stats

        for emp_data in empleados:
            nomiweb_id = emp_data.get('idempleado')
            try:
                data = self.mapper.contratosemp_to_employee(emp_data, tenant)

                # Check required fields before attempting create
                missing = _EMPLOYEE_REQUIRED - set(k for k, v in data.items() if v is not None)
                existing = Employee.objects.filter(
                    tenant=tenant, nomiweb_empleado_id=nomiweb_id
                ).first()

                if missing and not existing:
                    logger.warning(
                        f'Empleado {nomiweb_id} omitido — faltan: {missing}'
                    )
                    self._log(tenant, 'nomiweb_to_hcm', 'employee',
                               nomiweb_id, status='skipped',
                               error=f'Campos requeridos faltantes: {missing}')
                    stats['skipped'] += 1
                    continue

                employee, created = Employee.objects.update_or_create(
                    tenant=tenant,
                    nomiweb_empleado_id=nomiweb_id,
                    defaults=data,
                )
                stats['employees'] += 1
                stats['created' if created else 'updated'] += 1
                self._log(tenant, 'nomiweb_to_hcm', 'employee',
                           nomiweb_id, employee.id, 'success',
                           'created' if created else 'updated')

                # Sync contratos del empleado
                self._sync_contracts_for_employee(
                    tenant, employee, nomiweb_id, stats
                )

            except Exception as e:
                self._log(tenant, 'nomiweb_to_hcm', 'employee',
                           nomiweb_id, status='error', error=str(e))
                logger.error(f'Error sync empleado {nomiweb_id}: {e}')
                stats['errors'] += 1
                continue

        return stats

    def _sync_contracts_for_employee(self, tenant, employee, nomiweb_id, stats):
        from apps.personnel.models import Contract

        try:
            contratos = self.client.get_contratos(nomiweb_id)
        except NomiwebAPIError as e:
            logger.warning(f'Error contratos empleado {nomiweb_id}: {e}')
            return

        for contrato_data in contratos:
            contrato_id = contrato_data.get('idcontrato')
            try:
                mapped = self.mapper.contratos_to_contract(
                    contrato_data, employee, tenant
                )

                existing = Contract.objects.filter(
                    employee=employee, nomiweb_contrato_id=contrato_id
                ).first()
                missing = _CONTRACT_REQUIRED - set(k for k, v in mapped.items() if v is not None)

                if missing and not existing:
                    logger.warning(
                        f'Contrato {contrato_id} omitido — faltan: {missing}'
                    )
                    self._log(tenant, 'nomiweb_to_hcm', 'contract',
                               contrato_id, status='skipped',
                               error=f'Campos requeridos faltantes: {missing}')
                    stats['skipped'] += 1
                    continue

                contract, created = Contract.objects.update_or_create(
                    employee=employee,
                    nomiweb_contrato_id=contrato_id,
                    defaults=mapped,
                )
                stats['contracts'] += 1
                self._log(tenant, 'nomiweb_to_hcm', 'contract',
                           contrato_id, contract.id, 'success',
                           'created' if created else 'updated')
            except Exception as e:
                self._log(tenant, 'nomiweb_to_hcm', 'contract',
                           contrato_id, status='error', error=str(e))
                logger.error(f'Error sync contrato {contrato_id}: {e}')

    # ── Full sync ─────────────────────────────────────────────

    def full_sync_tenant(self, tenant):
        """Sincronización completa: empresa → catálogos → empleados → contratos."""
        config = getattr(tenant, 'nomiweb_config', None)
        if not config or not config.sync_enabled:
            logger.info(f'Sync deshabilitado para tenant {tenant.id}')
            return {'skipped': True}

        empresa_id = config.nomiweb_empresa_id
        logger.info(
            f'Iniciando sync completo: tenant={tenant.name} empresa_id={empresa_id}'
        )

        try:
            empresa_data = self.client.get_empresa(empresa_id)
            self.sync_tenant_from_empresa(tenant, empresa_data)
            cat_stats = self.sync_catalogs_for_tenant(tenant, empresa_id)
            emp_stats = self.sync_employees_for_tenant(tenant, empresa_id)

            config.last_sync_at = timezone.now()
            config.last_sync_status = 'success'
            config.save()

            total = {**cat_stats, **emp_stats}
            logger.info(f'Sync completo exitoso tenant={tenant.name}: {total}')
            return total

        except Exception as e:
            config.last_sync_status = 'error'
            config.save()
            logger.error(f'Error en sync completo tenant {tenant.id}: {e}')
            raise
