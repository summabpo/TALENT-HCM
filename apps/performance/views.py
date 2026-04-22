from django.db.models import Count
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.permissions import HasTenant, HasModule
from .models import (
    OKRPeriod, Objective, KeyResult, KeyResultUpdate,
    KPI, KPIMeasurement,
)
from .serializers import (
    OKRPeriodSerializer,
    ObjectiveSerializer, ObjectiveListSerializer,
    KeyResultSerializer, KeyResultUpdateSerializer,
    KPISerializer, KPIListSerializer, KPIMeasurementSerializer,
    PerformanceDashboardSerializer,
)


class PerformanceModulePermission(HasModule):
    module = 'performance'


PERF_PERMISSIONS = [HasTenant, PerformanceModulePermission]


class OKRPeriodViewSet(viewsets.ModelViewSet):
    permission_classes = PERF_PERMISSIONS
    serializer_class = OKRPeriodSerializer

    def get_queryset(self):
        qs = OKRPeriod.objects.for_tenant(self.request.tenant)
        if self.request.query_params.get('active') == 'true':
            qs = qs.filter(is_active=True)
        return qs

    @action(detail=True, methods=['get', 'post'], url_path='objectives')
    def objectives(self, request, pk=None):
        """List or create objectives under a specific period."""
        period = self.get_object()
        if request.method == 'GET':
            qs = Objective.objects.for_tenant(request.tenant).filter(
                period=period,
            ).select_related('department', 'owner', 'parent').prefetch_related('key_results')
            if level := request.query_params.get('level'):
                qs = qs.filter(level=level)
            if status_filter := request.query_params.get('status'):
                qs = qs.filter(status=status_filter)
            serializer_class = ObjectiveListSerializer if request.query_params.get('list') else ObjectiveSerializer
            return Response(serializer_class(qs, many=True, context={'request': request}).data)

        serializer = ObjectiveSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(period=period, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ObjectiveViewSet(viewsets.ModelViewSet):
    permission_classes = PERF_PERMISSIONS

    def get_queryset(self):
        qs = Objective.objects.for_tenant(
            self.request.tenant,
        ).select_related('period', 'department', 'owner', 'parent').prefetch_related(
            'key_results__responsible',
        )
        # Scope to period when accessed via nested URL
        if period_pk := self.kwargs.get('period_pk'):
            qs = qs.filter(period_id=period_pk)
        if period_id := self.request.query_params.get('period'):
            qs = qs.filter(period_id=period_id)
        if level := self.request.query_params.get('level'):
            qs = qs.filter(level=level)
        if status_filter := self.request.query_params.get('status'):
            qs = qs.filter(status=status_filter)
        if self.request.query_params.get('root') == 'true':
            qs = qs.filter(parent__isnull=True)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ObjectiveListSerializer
        return ObjectiveSerializer

    @action(detail=True, methods=['get', 'post'], url_path='key-results')
    def key_results(self, request, pk=None, **kwargs):
        """List or create key results under a specific objective."""
        objective = self.get_object()
        if request.method == 'GET':
            qs = objective.key_results.select_related('responsible').prefetch_related('updates')
            return Response(KeyResultSerializer(qs, many=True, context={'request': request}).data)

        serializer = KeyResultSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(objective=objective, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class KeyResultViewSet(viewsets.ModelViewSet):
    permission_classes = PERF_PERMISSIONS
    serializer_class = KeyResultSerializer

    def get_queryset(self):
        qs = KeyResult.objects.for_tenant(
            self.request.tenant,
        ).select_related('objective', 'responsible').prefetch_related('updates')
        # Scope to objective when accessed via nested URL
        if objective_pk := self.kwargs.get('objective_pk'):
            qs = qs.filter(objective_id=objective_pk)
        return qs

    @action(detail=True, methods=['get', 'post'], url_path='updates')
    def updates(self, request, pk=None, **kwargs):
        """
        GET  — list updates (check-ins) for a key result.
        POST — record a new check-in; automatically advances current_value.
        """
        kr = self.get_object()
        if request.method == 'GET':
            qs = kr.updates.all()
            return Response(
                KeyResultUpdateSerializer(qs, many=True, context={'request': request}).data
            )

        serializer = KeyResultUpdateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(key_result=kr, tenant=request.tenant, previous_value=kr.current_value)
        # Refresh to get updated current_value from model's save() signal
        kr.refresh_from_db()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class KeyResultUpdateViewSet(
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Retrieve or delete a specific key result update (check-in)."""
    permission_classes = PERF_PERMISSIONS
    serializer_class = KeyResultUpdateSerializer

    def get_queryset(self):
        qs = KeyResultUpdate.objects.for_tenant(
            self.request.tenant,
        ).select_related('key_result')
        if kr_pk := self.kwargs.get('kr_pk'):
            qs = qs.filter(key_result_id=kr_pk)
        return qs


class KPIViewSet(viewsets.ModelViewSet):
    permission_classes = PERF_PERMISSIONS

    def get_queryset(self):
        qs = KPI.objects.for_tenant(
            self.request.tenant,
        ).select_related('department', 'owner', 'quality_process').prefetch_related('measurements')
        if self.action == 'list' and self.request.query_params.get('all') != 'true':
            qs = qs.filter(is_active=True)
        if dept := self.request.query_params.get('department'):
            qs = qs.filter(department_id=dept)
        if freq := self.request.query_params.get('frequency'):
            qs = qs.filter(frequency=freq)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return KPIListSerializer
        return KPISerializer

    @action(detail=True, methods=['get', 'post'], url_path='measurements')
    def measurements(self, request, pk=None):
        """List or create measurements for a KPI."""
        kpi = self.get_object()
        if request.method == 'GET':
            qs = kpi.measurements.all()
            return Response(
                KPIMeasurementSerializer(qs, many=True, context={'request': request}).data
            )

        serializer = KPIMeasurementSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(kpi=kpi, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class KPIMeasurementViewSet(
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Retrieve or delete a specific KPI measurement."""
    permission_classes = PERF_PERMISSIONS
    serializer_class = KPIMeasurementSerializer

    def get_queryset(self):
        qs = KPIMeasurement.objects.for_tenant(
            self.request.tenant,
        ).select_related('kpi')
        if kpi_pk := self.kwargs.get('kpi_pk'):
            qs = qs.filter(kpi_id=kpi_pk)
        return qs


class PerformanceDashboardView(viewsets.ViewSet):
    permission_classes = PERF_PERMISSIONS

    def list(self, request):
        tenant = request.tenant

        active_period = OKRPeriod.objects.filter(tenant=tenant, is_active=True).first()
        objectives_qs = Objective.objects.for_tenant(tenant)
        if active_period:
            objectives_qs = objectives_qs.filter(period=active_period)

        by_status = objectives_qs.values('status').annotate(n=Count('id'))
        objectives_by_status = {r['status']: r['n'] for r in by_status}

        by_level = objectives_qs.values('level').annotate(n=Count('id'))
        objectives_by_level = {r['level']: r['n'] for r in by_level}

        avg_by_level: dict[str, float] = {}
        for level_choice, _ in Objective.LEVEL_CHOICES:
            objs = list(objectives_qs.filter(level=level_choice).prefetch_related('key_results'))
            if objs:
                avg_by_level[level_choice] = round(
                    sum(o.progress_percentage for o in objs) / len(objs), 1
                )

        active_kpis = KPI.objects.for_tenant(tenant).filter(is_active=True)
        active_kpis_count = active_kpis.count()
        kpis_on_target = sum(
            1 for kpi in active_kpis.prefetch_related('measurements')
            if (m := kpi.measurements.order_by('-period_date').first())
            and float(m.value) >= float(kpi.target_value)
        )

        return Response(PerformanceDashboardSerializer({
            'active_period': active_period,
            'objectives_by_status': objectives_by_status,
            'objectives_by_level': objectives_by_level,
            'avg_progress_by_level': avg_by_level,
            'active_kpis_count': active_kpis_count,
            'kpis_on_target': kpis_on_target,
        }, context={'request': request}).data)
