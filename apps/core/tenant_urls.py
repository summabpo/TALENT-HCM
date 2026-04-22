from rest_framework.routers import DefaultRouter

from .tenant_views import TenantAdminViewSet

router = DefaultRouter()
router.register(r'', TenantAdminViewSet, basename='tenant-admin')

urlpatterns = router.urls
