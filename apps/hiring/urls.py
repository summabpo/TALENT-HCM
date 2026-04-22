from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    HiringProcessViewSet, CandidateViewSet,
    OnboardingChecklistViewSet, OnboardingTaskViewSet,
    EmployeeOnboardingViewSet,
)

router = DefaultRouter()
router.register('processes', HiringProcessViewSet, basename='hiring-process')
router.register('candidates', CandidateViewSet, basename='candidate')
router.register('onboarding-checklists', OnboardingChecklistViewSet, basename='onboarding-checklist')
router.register('onboardings', EmployeeOnboardingViewSet, basename='employee-onboarding')

# Nested: /processes/{process_pk}/candidates/{pk}/
_candidate_detail = CandidateViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

# Nested: /processes/{process_pk}/candidates/{pk}/hire/
_candidate_hire = CandidateViewSet.as_view({'post': 'hire'})

# Nested: /onboarding-checklists/{checklist_pk}/tasks/{pk}/
_task_detail = OnboardingTaskViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

urlpatterns = router.urls + [
    path(
        'processes/<uuid:process_pk>/candidates/<uuid:pk>/',
        _candidate_detail,
        name='process-candidate-detail',
    ),
    path(
        'processes/<uuid:process_pk>/candidates/<uuid:pk>/hire/',
        _candidate_hire,
        name='process-candidate-hire',
    ),
    path(
        'onboarding-checklists/<uuid:checklist_pk>/tasks/<uuid:pk>/',
        _task_detail,
        name='checklist-task-detail',
    ),
]
