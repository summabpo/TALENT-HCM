from django.urls import path
from apps.integrations.webhook_receiver import WebhookReceiverView

urlpatterns = [
    path('webhooks/receive/', WebhookReceiverView.as_view(), name='webhook-receiver'),
]
