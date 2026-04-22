from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, mixins, status, serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from apps.core.permissions import HasTenant, HasModule
from .models import (
    HiringProcess, Candidate,
    OnboardingChecklist, OnboardingTask,
    EmployeeOnboarding, OnboardingTaskCompletion,
)
from .serializers import (
    HiringProcessSerializer, CandidateSerializer, HireActionSerializer,
    OnboardingChecklistSerializer, OnboardingTaskSerializer,
    EmployeeOnboardingSerializer, OnboardingTaskCompletionSerializer,
    CompleteTaskSerializer,
)
from .services import hire_candidate


class HiringModulePermission(HasModule):
    module = 'hiring'


HIRING_PERMISSIONS = [HasTenant, HiringModulePermission]


class HiringProcessViewSet(viewsets.ModelViewSet):
    permission_classes = HIRING_PERMISSIONS
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = HiringProcess.objects.for_tenant(self.request.tenant).select_related('department')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_class(self):
        return HiringProcessSerializer

    @action(detail=True, methods=['get', 'post'], url_path='candidates')
    def candidates(self, request, pk=None):
        process = self.get_object()
        if request.method == 'GET':
            qs = Candidate.objects.filter(
                tenant=request.tenant, hiring_process=process,
            )
            status_filter = request.query_params.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter)
            return Response(CandidateSerializer(qs, many=True, context={'request': request}).data)

        serializer = CandidateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(hiring_process=process, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CandidateViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Retrieve / update / delete a candidate.
    Creation goes through /processes/{id}/candidates/.
    When accessed as /processes/{process_pk}/candidates/{pk}/, queryset is scoped
    to the given process.
    """
    permission_classes = HIRING_PERMISSIONS
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = CandidateSerializer

    def get_queryset(self):
        qs = Candidate.objects.for_tenant(self.request.tenant).select_related(
            'hiring_process', 'employee',
        )
        process_pk = self.kwargs.get('process_pk')
        if process_pk:
            qs = qs.filter(hiring_process_id=process_pk)
        return qs

    @action(detail=True, methods=['post'], url_path='hire')
    def hire(self, request, pk=None, **kwargs):
        """
        Transition candidate → hired, auto-create Employee, start default onboarding.
        POST /api/v1/hiring/processes/{process_pk}/candidates/{pk}/hire/
        Body: { "document_type": <int>, "document_number": <int> }
        """
        candidate = self.get_object()
        serializer = HireActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            employee = hire_candidate(
                candidate=candidate,
                document_type_id=serializer.validated_data['document_type'],
                document_number=serializer.validated_data['document_number'],
                request_user=str(request.user),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {'detail': 'Candidate hired.', 'employee_id': str(employee.id)},
            status=status.HTTP_200_OK,
        )


class OnboardingChecklistViewSet(viewsets.ModelViewSet):
    permission_classes = HIRING_PERMISSIONS
    serializer_class = OnboardingChecklistSerializer

    def get_queryset(self):
        return OnboardingChecklist.objects.for_tenant(
            self.request.tenant,
        ).prefetch_related('tasks')

    @action(detail=True, methods=['get', 'post'], url_path='tasks')
    def tasks(self, request, pk=None):
        checklist = self.get_object()
        if request.method == 'GET':
            qs = checklist.tasks.all()
            return Response(
                OnboardingTaskSerializer(qs, many=True, context={'request': request}).data
            )

        serializer = OnboardingTaskSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(checklist=checklist, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OnboardingTaskViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Detail CRUD for tasks scoped under a checklist."""
    permission_classes = HIRING_PERMISSIONS
    serializer_class = OnboardingTaskSerializer

    def get_queryset(self):
        qs = OnboardingTask.objects.for_tenant(
            self.request.tenant,
        ).select_related('checklist')
        checklist_pk = self.kwargs.get('checklist_pk')
        if checklist_pk:
            qs = qs.filter(checklist_id=checklist_pk)
        return qs


class EmployeeOnboardingViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Onboarding records for employees.
    Accessible flat at /hiring/onboardings/ and nested at
    /personnel/employees/{employee_pk}/onboarding/.
    """
    permission_classes = HIRING_PERMISSIONS
    serializer_class = EmployeeOnboardingSerializer

    def get_queryset(self):
        qs = EmployeeOnboarding.objects.for_tenant(
            self.request.tenant,
        ).select_related(
            'employee', 'checklist',
        ).prefetch_related(
            'completions__task',
        )
        employee_pk = self.kwargs.get('employee_pk')
        if employee_pk:
            qs = qs.filter(employee_id=employee_pk)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        from apps.personnel.models import Employee
        employee_pk = self.kwargs.get('employee_pk')
        employee = get_object_or_404(
            Employee.objects.for_tenant(self.request.tenant),
            pk=employee_pk,
        )
        if EmployeeOnboarding.objects.filter(employee=employee).exists():
            raise drf_serializers.ValidationError(
                {'employee': 'An onboarding record already exists for this employee.'}
            )
        onboarding = serializer.save(employee=employee, tenant=self.request.tenant)
        tasks = onboarding.checklist.tasks.all()
        OnboardingTaskCompletion.objects.bulk_create([
            OnboardingTaskCompletion(
                tenant=self.request.tenant,
                onboarding=onboarding,
                task=task,
            )
            for task in tasks
        ], ignore_conflicts=True)

    @action(detail=True, methods=['patch'], url_path=r'tasks/(?P<task_id>[^/.]+)/complete')
    def complete_task(self, request, pk=None, task_id=None, **kwargs):
        """
        Mark a single onboarding task as complete.
        PATCH .../onboarding/{pk}/tasks/{task_id}/complete/
        """
        onboarding = self.get_object()
        try:
            completion = onboarding.completions.get(task_id=task_id)
        except OnboardingTaskCompletion.DoesNotExist:
            return Response(
                {'detail': 'Task not found in this onboarding.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if completion.completed_at:
            return Response(
                {'detail': 'Task already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = CompleteTaskSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        completion.completed_at = timezone.now()
        completion.completed_by = ser.validated_data['completed_by']
        completion.notes = ser.validated_data['notes']
        completion.save(update_fields=['completed_at', 'completed_by', 'notes', 'updated_at'])

        if not onboarding.completions.filter(completed_at__isnull=True).exists():
            onboarding.status = 'completed'
            onboarding.completed_at = timezone.now()
            onboarding.save(update_fields=['status', 'completed_at', 'updated_at'])

        return Response(EmployeeOnboardingSerializer(onboarding, context={'request': request}).data)


class OnboardingTaskCompletionViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    List and mark task completions for an EmployeeOnboarding.
    Accessed at /personnel/employees/{employee_pk}/onboarding/{onboarding_pk}/task-completions/
    """
    permission_classes = HIRING_PERMISSIONS
    serializer_class = OnboardingTaskCompletionSerializer

    def get_queryset(self):
        onboarding_pk = self.kwargs.get('onboarding_pk')
        return OnboardingTaskCompletion.objects.for_tenant(
            self.request.tenant,
        ).filter(
            onboarding_id=onboarding_pk,
        ).select_related('task')

    def perform_create(self, serializer):
        onboarding_pk = self.kwargs.get('onboarding_pk')
        onboarding = get_object_or_404(
            EmployeeOnboarding.objects.for_tenant(self.request.tenant),
            pk=onboarding_pk,
        )
        serializer.save(
            onboarding=onboarding,
            tenant=self.request.tenant,
            completed_at=timezone.now(),
        )
