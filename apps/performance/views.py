from django.db.models import Count, Avg, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.permissions import HasTenant
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


class OKRPeriodViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
    serializer_class = OKRPeriodSerializer

    def get_queryset(self):
        return OKRPeriod.objects.for_tenant(self.request.tenant)


class ObjectiveViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]

    def get_queryset(self):
        qs = Objective.objects.for_tenant(
            self.request.tenant,
        ).select_related('period', 'department', 'owner', 'parent').prefetch_related(
            'key_results__responsible',
        )
        period_id = self.request.query_params.get('period')
        if period_id:
            qs = qs.filter(period_id=period_id)
        level = self.request.query_params.get('level')
        if level:
            qs = qs.filter(level=level)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        # Top-level only (no parent) — useful for tree root
        if self.request.query_params.get('root') == 'true':
            qs = qs.filter(parent__isnull=True)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ObjectiveListSerializer
        return ObjectiveSerializer

    # ─── Nested key results ──────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='key-results')
    def key_results(self, request, pk=None):
        objective = self.get_object()
        if request.method == 'GET':
            qs = objective.key_results.select_related('responsible').prefetch_related('updates')
            return Response(KeyResultSerializer(qs, many=True, context={'request': request}).data)

        serializer = KeyResultSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(objective=objective, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class KeyResultViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]
    serializer_class = KeyResultSerializer

    def get_queryset(self):
        return KeyResult.objects.for_tenant(
            self.request.tenant,
        ).select_related('objective', 'responsible').prefetch_related('updates')

    @action(detail=True, methods=['post'], url_path='updates')
    def add_update(self, request, pk=None):
        """
        POST /api/v1/performance/key-results/{id}/updates/
        Records a check-in; automatically updates KeyResult.current_value.
        """
        kr = self.get_object()
        data = request.data.copy()
        data['previous_value'] = kr.current_value
        data['key_result'] = str(kr.id)

        serializer = KeyResultUpdateSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(key_result=kr, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class KPIViewSet(viewsets.ModelViewSet):
    permission_classes = [HasTenant]

    def get_queryset(self):
        qs = KPI.objects.for_tenant(
            self.request.tenant,
        ).select_related('department', 'owner', 'quality_process').prefetch_related('measurements')
        if self.action == 'list':
            qs = qs.filter(is_active=True)
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department_id=dept)
        freq = self.request.query_params.get('frequency')
        if freq:
            qs = qs.filter(frequency=freq)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return KPIListSerializer
        return KPISerializer

    @action(detail=True, methods=['get', 'post'], url_path='measurements')
    def measurements(self, request, pk=None):
        kpi = self.get_object()
        if request.method == 'GET':
            qs = kpi.measurements.all()
            return Response(KPIMeasurementSerializer(qs, many=True, context={'request': request}).data)

        serializer = KPIMeasurementSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(kpi=kpi, tenant=request.tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PerformanceDashboardView(viewsets.ViewSet):
    permission_classes = [HasTenant]

    def list(self, request):
        tenant = request.tenant

        active_period = OKRPeriod.objects.filter(tenant=tenant, is_active=True).first()

        objectives_qs = Objective.objects.for_tenant(tenant)
        if active_period:
            objectives_qs = objectives_qs.filter(period=active_period)

        # Counts by status
        by_status = objectives_qs.values('status').annotate(n=Count('id'))
        objectives_by_status = {r['status']: r['n'] for r in by_status}

        # Counts by level
        by_level = objectives_qs.values('level').annotate(n=Count('id'))
        objectives_by_level = {r['level']: r['n'] for r in by_level}

        # Average progress per level (computed in Python — progress_percentage is a property)
        avg_by_level: dict[str, float] = {}
        for level_choice, _ in Objective.LEVEL_CHOICES:
            objs = list(objectives_qs.filter(level=level_choice).prefetch_related('key_results'))
            if objs:
                avg_by_level[level_choice] = round(
                    sum(o.progress_percentage for o in objs) / len(objs), 1
                )

        # KPI stats
        active_kpis = KPI.objects.for_tenant(tenant).filter(is_active=True)
        active_kpis_count = active_kpis.count()
        kpis_on_target = sum(
            1 for kpi in active_kpis.prefetch_related('measurements')
            if (m := kpi.measurements.order_by('-period_date').first())
            and float(m.value) >= float(kpi.target_value)
        )

        data = {
            'active_period': active_period,
            'objectives_by_status': objectives_by_status,
            'objectives_by_level': objectives_by_level,
            'avg_progress_by_level': avg_by_level,
            'active_kpis_count': active_kpis_count,
            'kpis_on_target': kpis_on_target,
        }
        return Response(PerformanceDashboardSerializer(data, context={'request': request}).data)
