from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from apps.core.permissions import HasTenant
from .models import Department, Employee, Contract, EmployeeDocument, EmployeeHistory
from .serializers import (
    DepartmentSerializer, DepartmentTreeSerializer,
    EmployeeListSerializer, EmployeeDetailSerializer, EmployeeWriteSerializer,
    ContractSerializer, EmployeeDocumentSerializer, EmployeeHistorySerializer,
)


class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
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
    permission_classes = [HasTenant]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Employee.objects.for_tenant(self.request.tenant).select_related(
            'document_type', 'department', 'direct_manager',
        )
        # Optional filters
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department_id=dept)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                first_last_name__icontains=search,
            ) | qs.filter(
                first_name__icontains=search,
            ) | qs.filter(
                document_number__icontains=search,
            )
        return qs.distinct()

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EmployeeWriteSerializer
        return EmployeeDetailSerializer

    # ─── Contracts ───────────────────────────────────────────────────────────

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

    # ─── Documents ───────────────────────────────────────────────────────────

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

    # ─── History ─────────────────────────────────────────────────────────────

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
    permission_classes = [HasTenant]
    serializer_class = ContractSerializer

    def get_queryset(self):
        return Contract.objects.for_tenant(self.request.tenant).select_related(
            'employee', 'contract_type', 'position',
            'eps', 'afp', 'ccf', 'severance_fund',
            'contributor_type', 'contributor_subtype',
        )
