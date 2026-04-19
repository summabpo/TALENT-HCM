import factory
from factory.django import DjangoModelFactory
from apps.core.models import Tenant
from apps.catalogs.models import DocumentType, ContractType, Position, OrganizationalLevel, WorkCenter
from apps.personnel.models import Department, Employee, Contract


class TenantFactory(DjangoModelFactory):
    class Meta:
        model = Tenant

    name = factory.Sequence(lambda n: f'Company {n}')
    slug = factory.Sequence(lambda n: f'company-{n}')


class DocumentTypeFactory(DjangoModelFactory):
    class Meta:
        model = DocumentType
        django_get_or_create = ('code',)

    name = 'Cédula de Ciudadanía'
    code = 'CC'
    dian_code = 13


class OrganizationalLevelFactory(DjangoModelFactory):
    class Meta:
        model = OrganizationalLevel

    tenant = factory.SubFactory(TenantFactory)
    name = 'Profesional'


class PositionFactory(DjangoModelFactory):
    class Meta:
        model = Position

    tenant = factory.SubFactory(TenantFactory)
    level = factory.SubFactory(OrganizationalLevelFactory, tenant=factory.SelfAttribute('..tenant'))
    name = factory.Sequence(lambda n: f'Position {n}')


class WorkCenterFactory(DjangoModelFactory):
    class Meta:
        model = WorkCenter

    tenant = factory.SubFactory(TenantFactory)
    name = 'Centro Principal'
    arl_rate = '0.522'


class ContractTypeFactory(DjangoModelFactory):
    class Meta:
        model = ContractType
        django_get_or_create = ('name',)

    name = 'Término Indefinido'


class DepartmentFactory(DjangoModelFactory):
    class Meta:
        model = Department

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f'Department {n}')


class EmployeeFactory(DjangoModelFactory):
    class Meta:
        model = Employee

    tenant = factory.SubFactory(TenantFactory)
    document_type = factory.SubFactory(DocumentTypeFactory)
    document_number = factory.Sequence(lambda n: 10000000 + n)
    first_name = 'Juan'
    first_last_name = 'Pérez'
    department = factory.SubFactory(DepartmentFactory, tenant=factory.SelfAttribute('..tenant'))
