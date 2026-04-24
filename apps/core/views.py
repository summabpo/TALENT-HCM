import logging

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView

from apps.core.models import TenantModules, UserTenant
from apps.core.serializers import (
    LoginSerializer,
    RegisterSerializer,
    TenantModulesSerializer,
    TenantSummarySerializer,
    issue_platform_admin_tokens,
    issue_tokens,
)
from apps.core.throttling import LoginRateThrottle

security_logger = logging.getLogger('security')


class LoginView(APIView):
    """POST /api/v1/auth/login/"""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            errors = serializer.errors
            if errors.get('tenant_required'):
                return Response(
                    {'tenant_required': True, 'tenants': errors['tenants']},
                    status=status.HTTP_200_OK,
                )
            email = request.data.get('email', 'unknown')
            ip = request.META.get('REMOTE_ADDR', 'unknown')
            security_logger.warning('Login fallido para %s desde %s', email, ip)
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        if data.get('platform_admin'):
            return Response(issue_platform_admin_tokens(data['user']), status=status.HTTP_200_OK)
        return Response(
            issue_tokens(data['user'], data['membership']),
            status=status.HTTP_200_OK,
        )


class RegisterView(APIView):
    """POST /api/v1/auth/register/"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Account created. An admin must assign you to a tenant.'}, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — blacklists the refresh token."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data.get('refresh', ''))
            token.blacklist()
        except TokenError:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/v1/auth/me/ — frontend bootstrap endpoint."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.core.models import Tenant as TenantModel
        user = request.user
        tenant_id = getattr(user, '_jwt_tenant_id', None)
        tenant = None
        if tenant_id:
            try:
                tenant = TenantModel.objects.get(id=tenant_id, is_active=True)
            except TenantModel.DoesNotExist:
                pass
        roles = getattr(user, '_jwt_roles', [])

        modules_data = {}
        if tenant:
            try:
                modules_data = TenantModulesSerializer(tenant.modules).data
            except TenantModules.DoesNotExist:
                pass

        return Response({
            'user': {
                'id': str(user.id),
                'email': user.email,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'fullName': user.full_name,
                'roles': roles,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            },
            'tenant': TenantSummarySerializer(tenant).data if tenant else None,
            'modules': modules_data,
        })


class TokenRefreshView(BaseTokenRefreshView):
    """POST /api/v1/auth/token/refresh/ — extends simplejwt's view."""
    pass
