import factory
from datetime import date
from factory.django import DjangoModelFactory
from apps.personnel.tests.factories import TenantFactory, TenantModulesFactory, EmployeeFactory
from apps.quality.models import (
    QualityProcess, QualityDocument,
    InternalAudit, AuditFinding,
    NonConformity, ContinuousImprovement,
)


class QualityProcessFactory(DjangoModelFactory):
    class Meta:
        model = QualityProcess

    tenant = factory.SubFactory(TenantFactory)
    code = factory.Sequence(lambda n: f'PR-{n:03d}')
    name = factory.Sequence(lambda n: f'Process {n}')
    status = 'active'
    version = '1.0'


class QualityDocumentFactory(DjangoModelFactory):
    class Meta:
        model = QualityDocument

    tenant = factory.SubFactory(TenantFactory)
    process = factory.SubFactory(QualityProcessFactory, tenant=factory.SelfAttribute('..tenant'))
    code = factory.Sequence(lambda n: f'DOC-{n:03d}')
    title = factory.Sequence(lambda n: f'Document {n}')
    document_type = 'procedure'
    version = '1.0'
    status = 'draft'
    file = ''  # FileField: empty path for test fixtures


class InternalAuditFactory(DjangoModelFactory):
    class Meta:
        model = InternalAudit

    tenant = factory.SubFactory(TenantFactory)
    code = factory.Sequence(lambda n: f'AUD-{n:03d}')
    process = factory.SubFactory(QualityProcessFactory, tenant=factory.SelfAttribute('..tenant'))
    auditor = factory.SubFactory(EmployeeFactory, tenant=factory.SelfAttribute('..tenant'))
    planned_date = date(2026, 6, 1)
    status = 'planned'


class AuditFindingFactory(DjangoModelFactory):
    class Meta:
        model = AuditFinding

    tenant = factory.SubFactory(TenantFactory)
    audit = factory.SubFactory(InternalAuditFactory, tenant=factory.SelfAttribute('..tenant'))
    finding_type = 'nonconformity_minor'
    description = factory.Sequence(lambda n: f'Finding {n}')


class NonConformityFactory(DjangoModelFactory):
    class Meta:
        model = NonConformity

    tenant = factory.SubFactory(TenantFactory)
    code = factory.Sequence(lambda n: f'NC-{n:03d}')
    source = 'audit'
    description = factory.Sequence(lambda n: f'Nonconformity {n}')
    status = 'open'


class ContinuousImprovementFactory(DjangoModelFactory):
    class Meta:
        model = ContinuousImprovement

    tenant = factory.SubFactory(TenantFactory)
    code = factory.Sequence(lambda n: f'CI-{n:03d}')
    title = factory.Sequence(lambda n: f'Improvement {n}')
    description = 'Description'
    proposed_by = factory.SubFactory(EmployeeFactory, tenant=factory.SelfAttribute('..tenant'))
    responsible = factory.SubFactory(EmployeeFactory, tenant=factory.SelfAttribute('..tenant'))
    status = 'proposed'
    priority = 'medium'
