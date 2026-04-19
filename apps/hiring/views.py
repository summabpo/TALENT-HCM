from django.utils import timezone
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from apps.core.permissions import HasTenant
from .models import (
    HiringProcess, Candidate,
    OnboardingChecklist, OnboardingTask,
    EmployeeOnboarding, OnboardingTaskCompletion,
)
from .serializers import (
    HiringProcessSerializer, CandidateSerializer, HireActionSerializer,
    OnboardingChecklistSerializer, OnboardingTaskSerializer,
    EmployeeOnboardingSerializer, CompleteTaskSerializer,
)
from .services import hire_candidate


class HiringProcessViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = HiringProcess.objects.for_tenant(self.request.tenant).select_related('department')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_class(self):
        return HiringProcessSerializer

    # ─── Nested candidates ───────────────────────────────────────────────────

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
    viewsets.GenericViewSet,
):
    """
    Retrieve / partial-update a candidate by ID.
    Creation goes through /processes/{id}/candidates/.
    """
    permission_classes = [HasTenant]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = CandidateSerializer

    def get_queryset(self):
        return Candidate.objects.for_tenant(self.request.tenant).select_related(
            'hiring_process', 'employee',
        )

    @action(detail=True, methods=['post'], url_path='hire')
    def hire(self, request, pk=None):
        """
        Transition candidate → hired, auto-create Employee, start default onboarding.
        POST /api/v1/hiring/candidates/{id}/hire/
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
    permission_classes = [HasTenant]
    serializer_class = OnboardingChecklistSerializer

    def get_queryset(self):
        return OnboardingChecklist.objects.for_tenant(
            self.request.tenant,
        ).prefetch_related('tasks')

    # ─── Nested tasks ────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='tasks')
    def tasks(self, request, pk=None):
        checklist = self.get_object()
        if request.method == 'GET':
            qs = checklist.tasks.all()
            return Response(OnboardingTaskSerializer(qs, many=True, context={'request': request}).data)

        serializer = OnboardingTaskSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(checklist=checklist, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EmployeeOnboardingViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Active onboardings — created automatically via hire_candidate().
    Supports listing, retrieving, and completing individual tasks.
    """
    permission_classes = [HasTenant]
    serializer_class = EmployeeOnboardingSerializer

    def get_queryset(self):
        qs = EmployeeOnboarding.objects.for_tenant(
            self.request.tenant,
        ).select_related(
            'employee', 'checklist',
        ).prefetch_related(
            'completions__task',
        )
        status_filter = self.request.query_params.get('status', 'in_progress')
        if status_filter != 'all':
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['patch'], url_path=r'tasks/(?P<task_id>[^/.]+)/complete')
    def complete_task(self, request, pk=None, task_id=None):
        """
        Mark a single onboarding task as complete.
        PATCH /api/v1/hiring/onboardings/{id}/tasks/{task_id}/complete/
        """
        onboarding = self.get_object()
        try:
            completion = onboarding.completions.get(task_id=task_id)
        except OnboardingTaskCompletion.DoesNotExist:
            return Response({'detail': 'Task not found in this onboarding.'}, status=status.HTTP_404_NOT_FOUND)

        if completion.completed_at:
            return Response({'detail': 'Task already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CompleteTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        completion.completed_at = timezone.now()
        completion.completed_by = serializer.validated_data['completed_by']
        completion.notes = serializer.validated_data['notes']
        completion.save(update_fields=['completed_at', 'completed_by', 'notes', 'updated_at'])

        # Auto-complete the onboarding if all tasks are done
        remaining = onboarding.completions.filter(completed_at__isnull=True).count()
        if remaining == 0:
            onboarding.status = 'completed'
            onboarding.completed_at = timezone.now()
            onboarding.save(update_fields=['status', 'completed_at', 'updated_at'])

        return Response(
            EmployeeOnboardingSerializer(onboarding, context={'request': request}).data
        )
