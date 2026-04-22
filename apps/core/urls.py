from django.urls import path
from .views import LoginView, LogoutView, MeView, RegisterView, TokenRefreshView

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('token/refresh/', TokenRefreshView.as_view(), name='auth-token-refresh'),
]
