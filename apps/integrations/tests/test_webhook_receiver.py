from django.test import TestCase
from unittest.mock import patch


class WebhookReceiverTest(TestCase):

    def test_webhook_sin_firma_rechazado(self):
        """Webhook sin firma debe retornar 401."""
        with self.settings(NOMIWEB_WEBHOOK_SECRET='secret-test'):
            resp = self.client.post(
                '/api/v1/webhooks/receive/',
                data={'evento': 'employee.updated'},
                content_type='application/json',
            )
            self.assertEqual(resp.status_code, 401)

    def test_webhook_con_firma_correcta(self):
        """Webhook con firma correcta debe retornar 200."""
        with self.settings(NOMIWEB_WEBHOOK_SECRET='secret-test'):
            with patch('apps.integrations.webhook_receiver._process_webhook_sync'):
                resp = self.client.post(
                    '/api/v1/webhooks/receive/',
                    data={
                        'evento': 'employee.updated',
                        'modelo': 'empleado',
                        'objeto_id': '1',
                        'empresa_id': '999',
                    },
                    content_type='application/json',
                    HTTP_X_NOMIWEB_SIGNATURE='secret-test',
                )
                self.assertEqual(resp.status_code, 200)
                self.assertEqual(resp.json(), {'status': 'received'})

    def test_webhook_payload_incompleto(self):
        """Payload sin campos requeridos debe retornar 400."""
        with self.settings(NOMIWEB_WEBHOOK_SECRET=''):
            resp = self.client.post(
                '/api/v1/webhooks/receive/',
                data={'evento': 'employee.updated'},
                content_type='application/json',
            )
            self.assertEqual(resp.status_code, 400)

    def test_webhook_sin_secret_configurado_pasa(self):
        """Si NOMIWEB_WEBHOOK_SECRET está vacío, cualquier firma pasa."""
        with self.settings(NOMIWEB_WEBHOOK_SECRET=''):
            with patch('apps.integrations.webhook_receiver._process_webhook_sync'):
                resp = self.client.post(
                    '/api/v1/webhooks/receive/',
                    data={
                        'evento': 'nomina.updated',
                        'modelo': 'nomina',
                        'objeto_id': '42',
                        'empresa_id': '1',
                    },
                    content_type='application/json',
                )
                self.assertEqual(resp.status_code, 200)
