from rest_framework.routers import DefaultRouter
from .views import DepartmentViewSet, EmployeeViewSet, ContractViewSet

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('employees', EmployeeViewSet, basename='employee')
router.register('contracts', ContractViewSet, basename='contract')

urlpatterns = router.urls
