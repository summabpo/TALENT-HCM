import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from apps.integrations.models import NomiwebConfig

logger = logging.getLogger('integrations.webhooks')


class WebhookReceiverView(APIView):
    """
    Recibe notificaciones de Nomiweb.
    POST /api/v1/webhooks/receive/

    Payload esperado:
    {
      "evento": "employee.updated",
      "modelo": "empleado",
      "objeto_id": "123",
      "empresa_id": "5",
      "timestamp": "2026-01-01T10:00:00"
    }
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        signature = request.headers.get('X-Nomiweb-Signature', '')
        expected = settings.NOMIWEB_WEBHOOK_SECRET

        if expected and signature != expected:
            logger.warning(
                f'Webhook rechazado: firma inválida '
                f'desde {request.META.get("REMOTE_ADDR")}'
            )
            return Response(
                {'error': 'Firma inválida'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        payload = request.data
        evento = payload.get('evento', '')
        modelo = payload.get('modelo', '')
        objeto_id = payload.get('objeto_id', '')
        empresa_id = payload.get('empresa_id')

        logger.info(
            f'Webhook recibido: {evento} {modelo}#{objeto_id} empresa={empresa_id}'
        )

        if not all([evento, modelo, objeto_id]):
            return Response(
                {'error': 'Payload incompleto'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.integrations.tasks import process_webhook_task
            process_webhook_task.delay(payload)
        except Exception:
            _process_webhook_sync(payload)

        return Response({'status': 'received'}, status=status.HTTP_200_OK)


def _process_webhook_sync(payload):
    """Procesa el webhook sincrónicamente (fallback cuando Celery no está disponible)."""
    evento = payload.get('evento', '')
    empresa_id = payload.get('empresa_id')
    objeto_id = payload.get('objeto_id')

    if not empresa_id:
        logger.warning(f'Webhook sin empresa_id: {payload}')
        return

    try:
        config = NomiwebConfig.objects.select_related('tenant').get(
            nomiweb_empresa_id=int(empresa_id),
            sync_enabled=True,
        )
    except NomiwebConfig.DoesNotExist:
        logger.info(f'No hay config de sync para empresa {empresa_id}')
        return
    except (ValueError, TypeError):
        logger.warning(f'empresa_id inválido: {empresa_id}')
        return

    tenant = config.tenant
    from apps.integrations.sync_service import NomiwebSyncService
    service = NomiwebSyncService()

    try:
        if evento in ('employee.created', 'employee.updated'):
            emp_data = service.client.get_empleado(objeto_id)
            data = service.mapper.contratosemp_to_employee(emp_data, tenant)
            from apps.personnel.models import Employee
            Employee.objects.update_or_create(
                tenant=tenant,
                nomiweb_empleado_id=int(objeto_id),
                defaults=data,
            )
            logger.info(f'Empleado #{objeto_id} sincronizado desde webhook')

        elif evento in ('contract.created', 'contract.updated'):
            contrato_data = service.client.get_contrato(objeto_id)
            from apps.personnel.models import Employee, Contract
            emp_id = (contrato_data.get('idempleado_id')
                      or contrato_data.get('idempleado'))
            try:
                employee = Employee.objects.get(
                    tenant=tenant,
                    nomiweb_empleado_id=emp_id,
                )
                data = service.mapper.contratos_to_contract(
                    contrato_data, employee, tenant
                )
                Contract.objects.update_or_create(
                    employee=employee,
                    nomiweb_contrato_id=int(objeto_id),
                    defaults=data,
                )
                logger.info(f'Contrato #{objeto_id} sincronizado desde webhook')
            except Employee.DoesNotExist:
                logger.warning(
                    f'Empleado {emp_id} no existe en HCM para contrato {objeto_id}'
                )

        elif evento == 'nomina.updated':
            logger.info(
                f'Nómina #{objeto_id} actualizada en Nomiweb — notificación registrada'
            )

    except Exception as e:
        logger.error(f'Error procesando webhook {evento} #{objeto_id}: {e}')
