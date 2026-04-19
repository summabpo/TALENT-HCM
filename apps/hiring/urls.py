from rest_framework.routers import DefaultRouter
from .views import (
    HiringProcessViewSet, CandidateViewSet,
    OnboardingChecklistViewSet, EmployeeOnboardingViewSet,
)

router = DefaultRouter()
router.register('processes', HiringProcessViewSet, basename='hiring-process')
router.register('candidates', CandidateViewSet, basename='candidate')
router.register('onboarding-checklists', OnboardingChecklistViewSet, basename='onboarding-checklist')
router.register('onboardings', EmployeeOnboardingViewSet, basename='employee-onboarding')

urlpatterns = router.urls
