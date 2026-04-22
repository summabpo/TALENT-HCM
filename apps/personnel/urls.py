from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import DepartmentViewSet, EmployeeViewSet, ContractViewSet
from apps.hiring.views import EmployeeOnboardingViewSet, OnboardingTaskCompletionViewSet

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('employees', EmployeeViewSet, basename='employee')
router.register('contracts', ContractViewSet, basename='contract')

# Nested contract detail: /employees/{employee_pk}/contracts/{pk}/
_contract_detail = ContractViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

# Onboarding nested under employee
_onboarding_list = EmployeeOnboardingViewSet.as_view({'get': 'list', 'post': 'create'})
_onboarding_detail = EmployeeOnboardingViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
})
_onboarding_complete_task = EmployeeOnboardingViewSet.as_view({'patch': 'complete_task'})

# Task completions nested under onboarding
_task_completion_list = OnboardingTaskCompletionViewSet.as_view({'get': 'list', 'post': 'create'})

urlpatterns = router.urls + [
    path(
        'employees/<uuid:employee_pk>/contracts/<uuid:pk>/',
        _contract_detail,
        name='employee-contract-detail',
    ),
    path(
        'employees/<uuid:employee_pk>/onboarding/',
        _onboarding_list,
        name='employee-onboarding-list',
    ),
    path(
        'employees/<uuid:employee_pk>/onboarding/<uuid:pk>/',
        _onboarding_detail,
        name='employee-onboarding-detail',
    ),
    path(
        'employees/<uuid:employee_pk>/onboarding/<uuid:pk>/tasks/<uuid:task_id>/complete/',
        _onboarding_complete_task,
        name='employee-onboarding-complete-task',
    ),
    path(
        'employees/<uuid:employee_pk>/onboarding/<uuid:onboarding_pk>/task-completions/',
        _task_completion_list,
        name='employee-onboarding-task-completions',
    ),
]
