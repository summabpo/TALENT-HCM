from django.db.models import Q
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from apps.core.permissions import HasTenant, HasModule
from .models import Department, Employee, Contract, EmployeeDocument, EmployeeHistory
from .serializers import (
    DepartmentSerializer, DepartmentTreeSerializer,
    EmployeeListSerializer, EmployeeDetailSerializer, EmployeeWriteSerializer,
    ContractSerializer, EmployeeDocumentSerializer, EmployeeHistorySerializer,
)


class PersonnelModulePermission(HasModule):
    module = 'personnel'


PERSONNEL_PERMISSIONS = [HasTenant, PersonnelModulePermission]


class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = PERSONNEL_PERMISSIONS
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        return Department.objects.for_tenant(self.request.tenant).select_related(
            'parent', 'manager',
        )

    @action(detail=True, methods=['get'], url_path='org-tree')
    def org_tree(self, request, pk=None):
        dept = self.get_object()
        return Response(DepartmentTreeSerializer(dept).data)


class EmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = PERSONNEL_PERMISSIONS
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Employee.objects.for_tenant(self.request.tenant).select_related(
            'document_type', 'profession', 'department', 'direct_manager',
            'birth_country', 'residence_country',
            'birth_city', 'residence_city', 'document_expedition_city',
            'birth_city__state_province', 'residence_city__state_province',
            'document_expedition_city__state_province',
        )
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department_id=dept)
        search = self.request.query_params.get('search')
        if search:
            q = Q(first_last_name__icontains=search) | Q(first_name__icontains=search)
            try:
                q |= Q(document_number=int(search))
            except (ValueError, TypeError):
                pass
            qs = qs.filter(q)
        return qs.distinct()

    def destroy(self, request, *args, **kwargs):
        """Los empleados no se eliminan: se conserva el histórico (usar estado inactivo/retirado)."""
        return Response(
            {
                'detail': (
                    'No está permitido eliminar empleados. '
                    'Cambie el estado del empleado (inactivo, retirado, etc.) para conservar la información.'
                ),
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EmployeeWriteSerializer
        return EmployeeDetailSerializer

    @action(detail=True, methods=['get', 'post'], url_path='contracts')
    def contracts(self, request, pk=None):
        employee = self.get_object()
        if request.method == 'GET':
            qs = Contract.objects.filter(
                tenant=request.tenant, employee=employee,
            ).select_related('contract_type', 'position', 'eps', 'ccf')
            serializer = ContractSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)

        serializer = ContractSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(employee=employee, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=['get', 'post'], url_path='documents',
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def documents(self, request, pk=None):
        employee = self.get_object()
        if request.method == 'GET':
            qs = EmployeeDocument.objects.filter(tenant=request.tenant, employee=employee)
            serializer = EmployeeDocumentSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)

        serializer = EmployeeDocumentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(employee=employee, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        employee = self.get_object()
        qs = EmployeeHistory.objects.filter(tenant=request.tenant, employee=employee)
        serializer = EmployeeHistorySerializer(qs, many=True)
        return Response(serializer.data)


class ContractViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Direct contract access by ID (retrieve / update / delete).
    Creation goes through /employees/{id}/contracts/.
    """
    permission_classes = PERSONNEL_PERMISSIONS
    serializer_class = ContractSerializer

    def get_queryset(self):
        qs = Contract.objects.for_tenant(self.request.tenant).select_related(
            'employee', 'contract_type', 'position',
            'eps', 'afp', 'ccf', 'severance_fund',
            'contributor_type', 'contributor_subtype',
        )
        employee_pk = self.kwargs.get('employee_pk')
        if employee_pk:
            qs = qs.filter(employee_id=employee_pk)
        return qs
