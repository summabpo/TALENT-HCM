import pytest
from rest_framework.test import APIClient
from apps.core.models import User
from apps.personnel.tests.factories import TenantFactory, TenantModulesFactory
from apps.quality.models import (
    QualityProcess, QualityDocument, InternalAudit, AuditFinding,
    NonConformity, ContinuousImprovement,
)
from .factories import (
    QualityProcessFactory, QualityDocumentFactory,
    InternalAuditFactory, AuditFindingFactory,
    NonConformityFactory, ContinuousImprovementFactory,
)


def _make_user(tenant):
    user = User.objects.create_user(
        email=f'quality_{tenant.slug}@test.co',
        password='pass',
        first_name='Quality',
        last_name='User',
    )
    user._jwt_tenant_id = str(tenant.id)
    user._jwt_roles = ['admin']
    return user


def _client_for(tenant, quality=True):
    TenantModulesFactory(tenant=tenant, quality=quality)
    client = APIClient()
    client.force_authenticate(user=_make_user(tenant))
    return client


@pytest.mark.django_db
class TestModulePermission:
    def test_quality_disabled_returns_403_on_processes(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, quality=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/quality/processes/').status_code == 403

    def test_quality_disabled_returns_403_on_audits(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, quality=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/quality/audits/').status_code == 403

    def test_quality_disabled_returns_403_on_nonconformities(self):
        tenant = TenantFactory()
        TenantModulesFactory(tenant=tenant, quality=False)
        client = APIClient()
        client.force_authenticate(user=_make_user(tenant))
        assert client.get('/api/v1/quality/nonconformities/').status_code == 403

    def test_quality_enabled_returns_200(self):
        tenant = TenantFactory()
        client = _client_for(tenant, quality=True)
        assert client.get('/api/v1/quality/processes/').status_code == 200


@pytest.mark.django_db
class TestTenantIsolation:
    def test_process_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        proc_a = QualityProcessFactory(tenant=tenant_a)
        QualityProcessFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/quality/processes/')

        assert response.status_code == 200
        ids = [p['id'] for p in response.json()['results']]
        assert str(proc_a.id) in ids
        assert len(ids) == 1

    def test_document_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        proc_a = QualityProcessFactory(tenant=tenant_a)
        QualityDocumentFactory(tenant=tenant_a, process=proc_a)
        QualityDocumentFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/quality/documents/')

        assert response.status_code == 200
        assert response.json()['count'] == 1

    def test_nonconformity_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        nc_a = NonConformityFactory(tenant=tenant_a)
        NonConformityFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/quality/nonconformities/')

        assert response.status_code == 200
        ids = [n['id'] for n in response.json()['results']]
        assert str(nc_a.id) in ids
        assert len(ids) == 1

    def test_audit_list_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        audit_a = InternalAuditFactory(tenant=tenant_a)
        InternalAuditFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/quality/audits/')

        assert response.status_code == 200
        assert response.json()['count'] == 1


@pytest.mark.django_db
class TestApproveDocumentAction:
    def test_approve_sets_status_and_timestamps(self):
        tenant = TenantFactory()
        process = QualityProcessFactory(tenant=tenant)
        doc = QualityDocumentFactory(tenant=tenant, process=process, status='draft')

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/quality/processes/{process.id}/documents/{doc.id}/approve/'
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'approved'
        assert data['approved_by'] != ''
        assert data['approved_at'] is not None

    def test_approve_already_approved_returns_400(self):
        tenant = TenantFactory()
        process = QualityProcessFactory(tenant=tenant)
        doc = QualityDocumentFactory(tenant=tenant, process=process, status='approved')

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/quality/processes/{process.id}/documents/{doc.id}/approve/'
        )
        assert response.status_code == 400

    def test_approve_scoped_to_process(self):
        """Approving a document via the wrong process returns 404."""
        tenant = TenantFactory()
        proc_a = QualityProcessFactory(tenant=tenant)
        proc_b = QualityProcessFactory(tenant=tenant)
        doc_b = QualityDocumentFactory(tenant=tenant, process=proc_b)

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/quality/processes/{proc_a.id}/documents/{doc_b.id}/approve/'
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestCloseNonConformityAction:
    def test_close_sets_status_and_closed_at(self):
        tenant = TenantFactory()
        nc = NonConformityFactory(tenant=tenant, status='in_progress')

        client = _client_for(tenant)
        response = client.post(
            f'/api/v1/quality/nonconformities/{nc.id}/close/',
            {'effectiveness_verified': True},
            format='json',
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'closed'
        assert data['closed_at'] is not None
        assert data['effectiveness_verified'] is True

    def test_close_already_closed_returns_400(self):
        tenant = TenantFactory()
        nc = NonConformityFactory(tenant=tenant, status='closed')

        client = _client_for(tenant)
        response = client.post(f'/api/v1/quality/nonconformities/{nc.id}/close/')
        assert response.status_code == 400

    def test_perform_update_auto_stamps_closed_at(self):
        """PATCH with status=closed auto-sets closed_at via perform_update."""
        tenant = TenantFactory()
        nc = NonConformityFactory(tenant=tenant, status='open')

        client = _client_for(tenant)
        response = client.patch(
            f'/api/v1/quality/nonconformities/{nc.id}/',
            {'status': 'closed'},
            format='json',
        )
        assert response.status_code == 200
        nc.refresh_from_db()
        assert nc.closed_at is not None


@pytest.mark.django_db
class TestNestedDocumentScoping:
    def test_document_list_scoped_to_process(self):
        tenant = TenantFactory()
        proc_a = QualityProcessFactory(tenant=tenant)
        proc_b = QualityProcessFactory(tenant=tenant)
        doc_a = QualityDocumentFactory(tenant=tenant, process=proc_a)
        QualityDocumentFactory(tenant=tenant, process=proc_b)

        client = _client_for(tenant)
        response = client.get(f'/api/v1/quality/processes/{proc_a.id}/documents/')

        assert response.status_code == 200
        ids = [d['id'] for d in response.json()]
        assert str(doc_a.id) in ids
        assert len(ids) == 1

    def test_document_detail_returns_404_under_wrong_process(self):
        tenant = TenantFactory()
        proc_a = QualityProcessFactory(tenant=tenant)
        proc_b = QualityProcessFactory(tenant=tenant)
        doc_b = QualityDocumentFactory(tenant=tenant, process=proc_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/quality/processes/{proc_a.id}/documents/{doc_b.id}/'
        )
        assert response.status_code == 404

    def test_document_detail_accessible_under_correct_process(self):
        tenant = TenantFactory()
        process = QualityProcessFactory(tenant=tenant)
        doc = QualityDocumentFactory(tenant=tenant, process=process)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/quality/processes/{process.id}/documents/{doc.id}/'
        )
        assert response.status_code == 200
        assert response.json()['id'] == str(doc.id)


@pytest.mark.django_db
class TestNestedFindingScoping:
    def test_finding_list_via_audit_action(self):
        tenant = TenantFactory()
        audit = InternalAuditFactory(tenant=tenant)
        AuditFindingFactory(tenant=tenant, audit=audit)
        AuditFindingFactory(tenant=tenant, audit=audit)

        client = _client_for(tenant)
        response = client.get(f'/api/v1/quality/audits/{audit.id}/findings/')

        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_finding_detail_scoped_to_audit(self):
        tenant = TenantFactory()
        audit = InternalAuditFactory(tenant=tenant)
        finding = AuditFindingFactory(tenant=tenant, audit=audit)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/quality/audits/{audit.id}/findings/{finding.id}/'
        )
        assert response.status_code == 200
        assert response.json()['id'] == str(finding.id)

    def test_finding_detail_returns_404_under_wrong_audit(self):
        tenant = TenantFactory()
        audit_a = InternalAuditFactory(tenant=tenant)
        audit_b = InternalAuditFactory(tenant=tenant)
        finding_b = AuditFindingFactory(tenant=tenant, audit=audit_b)

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/quality/audits/{audit_a.id}/findings/{finding_b.id}/'
        )
        assert response.status_code == 404

    def test_finding_type_filter_on_list(self):
        tenant = TenantFactory()
        audit = InternalAuditFactory(tenant=tenant)
        AuditFindingFactory(tenant=tenant, audit=audit, finding_type='nonconformity_major')
        AuditFindingFactory(tenant=tenant, audit=audit, finding_type='observation')

        client = _client_for(tenant)
        response = client.get(
            f'/api/v1/quality/audits/{audit.id}/findings/?finding_type=nonconformity_major'
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]['finding_type'] == 'nonconformity_major'

    def test_finding_delete_via_nested_url(self):
        tenant = TenantFactory()
        audit = InternalAuditFactory(tenant=tenant)
        finding = AuditFindingFactory(tenant=tenant, audit=audit)

        client = _client_for(tenant)
        response = client.delete(
            f'/api/v1/quality/audits/{audit.id}/findings/{finding.id}/'
        )
        assert response.status_code == 204
        assert not AuditFinding.objects.filter(id=finding.id).exists()


@pytest.mark.django_db
class TestNonConformityStatusFilter:
    def test_filter_by_status(self):
        tenant = TenantFactory()
        NonConformityFactory(tenant=tenant, status='open', code='NC-001')
        NonConformityFactory(tenant=tenant, status='closed', code='NC-002')

        client = _client_for(tenant)
        response = client.get('/api/v1/quality/nonconformities/?status=open')

        assert response.status_code == 200
        assert response.json()['count'] == 1
        assert response.json()['results'][0]['status'] == 'open'

    def test_filter_by_source(self):
        tenant = TenantFactory()
        NonConformityFactory(tenant=tenant, source='audit', code='NC-003')
        NonConformityFactory(tenant=tenant, source='employee', code='NC-004')

        client = _client_for(tenant)
        response = client.get('/api/v1/quality/nonconformities/?source=audit')

        assert response.status_code == 200
        assert response.json()['count'] == 1


@pytest.mark.django_db
class TestContinuousImprovementCRUD:
    def test_list_improvements(self):
        tenant = TenantFactory()
        ContinuousImprovementFactory(tenant=tenant)
        ContinuousImprovementFactory(tenant=tenant)

        client = _client_for(tenant)
        response = client.get('/api/v1/quality/improvements/')

        assert response.status_code == 200
        assert response.json()['count'] == 2

    def test_improvement_excludes_other_tenant(self):
        tenant_a = TenantFactory()
        tenant_b = TenantFactory()
        ContinuousImprovementFactory(tenant=tenant_a)
        ContinuousImprovementFactory(tenant=tenant_b)

        client = _client_for(tenant_a)
        response = client.get('/api/v1/quality/improvements/')

        assert response.json()['count'] == 1
