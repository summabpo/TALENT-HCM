from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('', RedirectView.as_view(pattern_name='swagger-ui', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.core.urls')),
    path('api/v1/tenants/', include('apps.core.tenant_urls')),
    path('api/v1/catalogs/', include('apps.catalogs.urls')),
    path('api/v1/personnel/', include('apps.personnel.urls')),
    path('api/v1/hiring/', include('apps.hiring.urls')),
    path('api/v1/quality/', include('apps.quality.urls')),
    path('api/v1/performance/', include('apps.performance.urls')),
    path('api/v1/', include('apps.integrations.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
