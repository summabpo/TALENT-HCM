import factory
from datetime import date
from factory.django import DjangoModelFactory
from apps.core.models import Tenant, TenantModules
from apps.catalogs.models import (
    DocumentType, ContractType, Position, OrganizationalLevel,
    WorkCenter, SocialSecurityEntity, SocialSecurityEntityType,
    ContributorType,
)
from apps.personnel.models import Department, Employee, Contract


class TenantFactory(DjangoModelFactory):
    class Meta:
        model = Tenant

    name = factory.Sequence(lambda n: f'Company {n}')
    slug = factory.Sequence(lambda n: f'company-{n}')


class TenantModulesFactory(DjangoModelFactory):
    class Meta:
        model = TenantModules

    tenant = factory.SubFactory(TenantFactory)
    hiring = True
    personnel = True
    quality = True
    performance = True
    evaluations = False
    portal = False
    surveys = False
    orgchart = False


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


class SocialSecurityEntityFactory(DjangoModelFactory):
    class Meta:
        model = SocialSecurityEntity
        django_get_or_create = ('code', 'entity_type')

    code = factory.Sequence(lambda n: f'EPS{n:03d}')
    nit = factory.Sequence(lambda n: f'9000{n:05d}')
    name = factory.Sequence(lambda n: f'EPS Entity {n}')
    entity_type = SocialSecurityEntityType.EPS


class ContributorTypeFactory(DjangoModelFactory):
    class Meta:
        model = ContributorType
        django_get_or_create = ('code',)

    code = '01'
    description = 'Empleado'


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


class ContractFactory(DjangoModelFactory):
    class Meta:
        model = Contract

    tenant = factory.SubFactory(TenantFactory)
    employee = factory.SubFactory(EmployeeFactory, tenant=factory.SelfAttribute('..tenant'))
    contract_type = factory.SubFactory(ContractTypeFactory)
    start_date = date(2024, 1, 1)
    salary = '2000000.00'
    position = factory.SubFactory(PositionFactory, tenant=factory.SelfAttribute('..tenant'))
    work_center = factory.SubFactory(WorkCenterFactory, tenant=factory.SelfAttribute('..tenant'))
    eps = factory.SubFactory(SocialSecurityEntityFactory, entity_type=SocialSecurityEntityType.EPS)
    ccf = factory.SubFactory(
        SocialSecurityEntityFactory,
        code=factory.Sequence(lambda n: f'CCF{n:03d}'),
        entity_type=SocialSecurityEntityType.CCF,
    )
    contributor_type = factory.SubFactory(ContributorTypeFactory)
