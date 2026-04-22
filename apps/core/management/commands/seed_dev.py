# noqa: C901 - seed script is intentionally large
from datetime import date, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from apps.core.models import Role, Tenant, TenantModules, User, UserTenant


DEMO_TENANT_SLUG = 'demo'
DEMO_TENANT_NAME = 'Demo Company'


class Command(BaseCommand):
    help = 'Seed dev/demo data: roles, tenant Demo Company, user admin@demo.co, full module demos (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stats = {k: 0 for k in [
            'banks', 'eps', 'afp', 'arl', 'ccf', 'ces',
            'org_levels', 'departments', 'positions', 'cost_centers', 'sub_cost_centers',
            'work_locations', 'work_centers', 'employees', 'contracts',
            'hiring_processes', 'candidates', 'hiring',
            'q_processes', 'audits', 'findings', 'ncs', 'improvements',
            'okr_periods', 'objectives', 'key_results', 'kpis', 'kpi_measures',
        ]}

        self._seed_roles()
        tenant = self._seed_tenant()
        self._seed_modules(tenant)
        self._seed_user(tenant)
        self._call_seed_catalogs()
        self._seed_global_banks_and_entities()
        self._seed_tenant_personnel_block(tenant)
        self._seed_hiring(tenant)
        self._seed_quality(tenant)
        self._seed_performance(tenant)
        self._print_summary()
        self.stdout.write(self.style.SUCCESS('Dev seed complete (idempotent).'))

    def _seed_roles(self):
        for role_name, _ in Role.Name.choices:
            Role.objects.get_or_create(name=role_name)
        self.stdout.write(f'  Roles: {Role.objects.count()}')

    def _seed_tenant(self):
        tenant, created = Tenant.objects.get_or_create(
            slug=DEMO_TENANT_SLUG,
            defaults={'name': DEMO_TENANT_NAME, 'is_active': True},
        )
        if created:
            self.stdout.write('  Tenant: Demo Company created')
        else:
            self.stdout.write('  Tenant: Demo Company already exists')
        return tenant

    def _seed_modules(self, tenant):
        modules, _ = TenantModules.objects.get_or_create(
            tenant=tenant,
            defaults={
                'hiring': True, 'personnel': True, 'quality': True, 'evaluations': True,
                'performance': True, 'portal': True, 'surveys': True, 'orgchart': True,
            },
        )
        TenantModules.objects.filter(tenant=tenant).update(
            hiring=True, personnel=True, quality=True, performance=True, evaluations=True,
            portal=True, surveys=True, orgchart=True,
        )
        _ = modules
        self.stdout.write(f'  Modules: all enabled for {tenant.name}')

    def _seed_user(self, tenant):
        email = 'admin@demo.co'
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': 'Admin', 'last_name': 'Demo',
                'is_staff': True, 'is_superuser': True,
            },
        )
        if not user.has_usable_password():
            user.set_password('admin1234')
            user.save()
        else:
            self.stdout.write(f'  User: {email} (password unchanged)')

        membership, _ = UserTenant.objects.get_or_create(
            user=user, tenant=tenant,
            defaults={'is_active': True},
        )
        _ = membership
        admin_role = Role.objects.get(name=Role.Name.ADMIN)
        membership.roles.add(admin_role)
        self.stdout.write(f'  UserTenant: {user.email} → {tenant.name} [admin]')

    def _call_seed_catalogs(self):
        try:
            call_command('seed_catalogs', verbosity=0)
            self.stdout.write('  Base catalogs: seed_catalogs')
        except Exception as exc:  # pragma: no cover
            self.stdout.write(self.style.WARNING(f'  seed_catalogs: {exc}'))
        self._seed_payroll_types()

    def _seed_payroll_types(self):
        from apps.catalogs.models import PayrollType
        for nombre, cod_dian in [
            ('Mensual', 1),
            ('Quincenal', 2),
            ('Semanal', 3),
            ('Decenal', 4),
        ]:
            PayrollType.objects.get_or_create(nombre=nombre, defaults={'cod_dian': cod_dian, 'activo': True})
        self.stdout.write(f'  PayrollTypes: {PayrollType.objects.count()}')

    def _pg_sync_sequence(self, table: str, column: str = 'id'):
        if connection.vendor != 'postgresql':
            return
        qn = connection.ops.quote_name
        t, col = qn(table), qn(column)
        sql = f"""
            SELECT setval(
                pg_get_serial_sequence('{table}', '{column}'),
                GREATEST(COALESCE((SELECT MAX({col}) FROM {t}), 1), 1)
            )
        """
        with connection.cursor() as cur:
            cur.execute(sql)

    def _seed_global_banks_and_entities(self):
        """Complementa seed_catalogs (PASO 1): bancos y entidades extra con códigos únicos."""
        from apps.catalogs.models import Bank, SocialSecurityEntity, SocialSecurityEntityType

        self._pg_sync_sequence('catalog_bank')
        self._pg_sync_sequence('catalog_social_security_entity')

        for code, name, ach, nit in [
            ('D-FAL', 'Banco Falabella', '1700', '9001234560'),
            ('D-ITU', 'Itaú', '1203', '8001527377'),
        ]:
            Bank.objects.update_or_create(
                code=code,
                defaults={'name': name, 'ach_code': ach, 'nit': nit, 'is_active': True},
            )
        self.stats['banks'] = Bank.objects.filter(is_active=True).count()

        # Famisanar EPS, Comfenalco CCF, ARL Bolívar (códigos únicos; no pisan entidades fijas)
        se_extra = [
            ('EPSFAM1', '830113729', 'Famisanar EPS', SocialSecurityEntityType.EPS, 'EPS033'),
            ('CCF-CFN', '890904902', 'Comfenalco CCF', SocialSecurityEntityType.CCF, 'CCF008'),
            ('ARL-BO1', '800209856', 'Seguros Bolívar ARL', SocialSecurityEntityType.ARL, 'ARP008'),
        ]
        for code, nit, name, etype, sgp in se_extra:
            SocialSecurityEntity.objects.get_or_create(
                code=code,
                defaults={'nit': nit, 'name': name, 'entity_type': etype, 'sgp_code': sgp, 'is_active': True},
            )

        for et, label in [
            (SocialSecurityEntityType.EPS, 'eps'),
            (SocialSecurityEntityType.AFP, 'afp'),
            (SocialSecurityEntityType.ARL, 'arl'),
            (SocialSecurityEntityType.CCF, 'ccf'),
            (SocialSecurityEntityType.CESANTIAS, 'ces'),
        ]:
            n = SocialSecurityEntity.objects.filter(entity_type=et, is_active=True).count()
            self.stats[label] = n

    def _city(self, *names: str):
        from apps.catalogs.models import City
        for n in names:
            c = City.objects.filter(name__iexact=n).first()
            if c:
                return c
        return City.objects.order_by('id').first()

    def _seed_tenant_personnel_block(self, tenant):
        from apps.catalogs.models import (
            Bank, Country, ContractType, DocumentType, SocialSecurityEntity, ContributorType,
            SalaryType, OrganizationalLevel, Position, CostCenter, SubCostCenter, WorkLocation,
            WorkCenter,
        )
        from apps.personnel.models import Department, Employee, Contract

        doc_type = DocumentType.objects.filter(code='CC').first()
        cti = ContractType.objects
        ct_indef = cti.get(id=1)
        ct_fijo = cti.get(id=2)
        ct_obra = cti.get(id=3)
        st_ord = SalaryType.objects.get(id=1)
        contrib = ContributorType.objects.get(code='12')
        co = Country.objects.filter(iso_code='CO').order_by('id').first()
        if not co:
            raise ValueError('Country CO not found: run seed_catalogs or migrate')
        bog = self._city('Bogotá D.C.', 'Bogotá')
        med = self._city('Medellín', 'Medellín')
        cali = self._city('Cali', 'Cali')
        bquilla = self._city('Barranquilla', 'Barranquilla') or bog
        ccf_c = SocialSecurityEntity.objects.get(code='CCF001')
        eps_sura = SocialSecurityEntity.objects.get(code='EPS001')
        eps_sanit = SocialSecurityEntity.objects.get(code='EPS005')
        afp_porv = SocialSecurityEntity.objects.get(code='AFP001')
        ces = SocialSecurityEntity.objects.get(code='CES001')

        bank_bc = Bank.objects.filter(name__icontains='Bancolombia').first()
        bank_bog = Bank.objects.filter(name__icontains='Bogotá').first()
        if not bank_bc:
            bank_bc = Bank.objects.first()

        # Niveles (6)
        level_specs = [
            'Dirección General', 'Gerencia', 'Jefatura', 'Coordinación',
            'Analista / Profesional', 'Operativo / Asistente',
        ]
        levels = {}
        for n in level_specs:
            o, c = OrganizationalLevel.objects.get_or_create(tenant=tenant, name=n)
            levels[n] = o
            if c:
                self.stats['org_levels'] += 1

        # Depts
        dnames = [
            'Recursos Humanos', 'Tecnología', 'Comercial', 'Operaciones', 'Finanzas', 'Legal',
        ]
        depts = {}
        for dname in dnames:
            o, c = Department.objects.get_or_create(tenant=tenant, name=dname, defaults={})
            depts[dname] = o
            if c:
                self.stats['departments'] += 1

        # Cargos (incl. Analista Finanzas)
        pos_specs = [
            ('Director de RRHH', 'Dirección General'),
            ('Gerente de TI', 'Gerencia'),
            ('Gerente Comercial', 'Gerencia'),
            ('Jefe de Nómina', 'Jefatura'),
            ('Jefe de Selección', 'Jefatura'),
            ('Coordinador de Bienestar', 'Coordinación'),
            ('Coordinador de Sistemas', 'Coordinación'),
            ('Analista de RRHH', 'Analista / Profesional'),
            ('Desarrollador Backend', 'Analista / Profesional'),
            ('Analista Comercial', 'Analista / Profesional'),
            ('Analista de Finanzas', 'Analista / Profesional'),
            ('Asistente Administrativo', 'Operativo / Asistente'),
            ('Auxiliar de Operaciones', 'Operativo / Asistente'),
        ]
        pos_by_name = {}
        for pname, lname in pos_specs:
            lv = levels[lname]
            p, c = Position.objects.get_or_create(
                tenant=tenant, name=pname, defaults={'level': lv, 'is_active': True},
            )
            if not c and p.level_id != lv.id:
                p.level = lv
                p.save(update_fields=['level', 'updated_at'])
            pos_by_name[pname] = p
            if c:
                self.stats['positions'] += 1

        # Centros y sub
        ccs = {}
        for code, n in [
            ('CC001', 'CC001 Administrativo'),
            ('CC002', 'CC002 Tecnología'),
            ('CC003', 'CC003 Comercial'),
            ('CC004', 'CC004 Operaciones'),
        ]:
            o, c = CostCenter.objects.get_or_create(
                tenant=tenant, name=n,
                defaults={'accounting_group': code[:4], 'is_active': True},
            )
            ccs[code] = o
            if c:
                self.stats['cost_centers'] += 1

        sub_data = [
            (ccs['CC001'], 'CC001-01 Nómina'),
            (ccs['CC001'], 'CC001-02 Bienestar'),
            (ccs['CC002'], 'CC002-01 Desarrollo'),
            (ccs['CC002'], 'CC002-02 Infraestructura'),
            (ccs['CC003'], 'CC003-01 Ventas'),
            (ccs['CC003'], 'CC003-02 Marketing'),
            (ccs['CC004'], 'CC004-01 Logística'),
            (ccs['CC004'], 'CC004-02 Soporte'),
        ]
        for cc, nm in sub_data:
            _, c = SubCostCenter.objects.get_or_create(
                tenant=tenant, cost_center=cc, name=nm, defaults={'is_active': True},
            )
            if c:
                self.stats['sub_cost_centers'] += 1

        # Sedes
        wl1, c1 = WorkLocation.objects.get_or_create(
            tenant=tenant, name='Sede Principal Bogotá',
            defaults={'compensation_fund': ccf_c, 'is_active': True},
        )
        if c1:
            self.stats['work_locations'] += 1
        wl2, c2 = WorkLocation.objects.get_or_create(
            tenant=tenant, name='Sede Medellín (El Poblado)',
            defaults={'compensation_fund': ccf_c, 'is_active': True},
        )
        if c2:
            self.stats['work_locations'] += 1
        wl3, c3 = WorkLocation.objects.get_or_create(
            tenant=tenant, name='Sede Remota',
            defaults={'compensation_fund': ccf_c, 'is_active': True},
        )
        if c3:
            self.stats['work_locations'] += 1

        # Centros de trabajo (sin FK a sede en el modelo)
        wc_data = [
            'CT-BOG-01 Torre Empresarial', 'CT-BOG-02 Piso Coworking', 'CT-MED-01 Oficina Medellín', 'CT-REM-01 Remoto',
        ]
        wcx = None
        for wn in wc_data:
            w, wc_created = WorkCenter.objects.get_or_create(
                tenant=tenant, name=wn, defaults={'arl_rate': Decimal('0.522'), 'is_active': True},
            )
            wcx = w
            if wc_created:
                self.stats['work_centers'] += 1

        city_ib = self._city('Ibagué') or bog

        # 10 empleados — cédula única, correos fijos
        staff = [
            (1024509001, 'Andrés', 'Felipe', 'Vargas', 'Gómez', 'a.vargas@demo.co', 'Recursos Humanos', 'Director de RRHH', 'CC001', 'CC001-01 Nómina', ct_indef, 11200000, date(2021, 3, 1), bog, bog, eps_sura, afp_porv, '0142789300011', 0),
            (1024509002, 'María', 'Fernanda', 'Ortiz', 'Londoño', 'm.ortiz@demo.co', 'Recursos Humanos', 'Jefe de Nómina', 'CC001', 'CC001-01 Nómina', ct_fijo, 7800000, date(2022, 2, 15), med, bog, eps_sanit, afp_porv, '0142789300012', 365),
            (1024509003, 'Juan', 'Pablo', 'Cárdenas', 'Restrepo', 'j.cardenas@demo.co', 'Recursos Humanos', 'Analista de RRHH', 'CC001', 'CC001-02 Bienestar', ct_fijo, 4200000, date(2023, 6, 1), cali, bog, eps_sanit, afp_porv, '0142789300013', 365),
            (1024509004, 'Carolina', '', 'Botero', 'Echeverri', 'c.botero@demo.co', 'Tecnología', 'Gerente de TI', 'CC002', 'CC002-01 Desarrollo', ct_indef, 10800000, date(2019, 8, 20), bog, bog, eps_sura, afp_porv, '0142789300014', 0),
            (1024509005, 'Sergio', 'Leonel', 'Parra', 'Zuluaga', 's.parra@demo.co', 'Tecnología', 'Desarrollador Backend', 'CC002', 'CC002-01 Desarrollo', ct_fijo, 6500000, date(2023, 1, 10), bquilla, bog, eps_sura, afp_porv, '0142789300015', 365),
            (1024509006, 'Valentina', '', 'Mejía', 'Correa', 'v.mejia@demo.co', 'Comercial', 'Gerente Comercial', 'CC003', 'CC003-01 Ventas', ct_indef, 12000000, date(2020, 1, 6), med, med, eps_sura, afp_porv, '0142789300016', 0),
            (1024509007, 'Mateo', '', 'Giraldo', 'Arias', 'm.giraldo@demo.co', 'Comercial', 'Analista Comercial', 'CC003', 'CC003-02 Marketing', ct_fijo, 4200000, date(2024, 1, 15), cali, cali, eps_sanit, afp_porv, '0142789300017', 365),
            (1024509008, 'Lina', 'Marcela', 'Franco', 'Múnera', 'l.franco@demo.co', 'Operaciones', 'Auxiliar de Operaciones', 'CC004', 'CC004-01 Logística', ct_obra, 2500000, date(2024, 3, 1), bog, bog, eps_sanit, afp_porv, '0142789300018', 120),
            (1024509009, 'Héctor', 'Fabio', 'Mosquera', 'Silva', 'h.mosquera@demo.co', 'Operaciones', 'Asistente Administrativo', 'CC004', 'CC004-02 Soporte', ct_obra, 2800000, date(2023, 11, 1), bog, bog, eps_sanit, afp_porv, '0142789300019', 150),
            (1024509010, 'Paola', '', 'Arbeláez', 'Córdoba', 'p.arbelaez@demo.co', 'Finanzas', 'Analista de Finanzas', 'CC001', 'CC001-01 Nómina', ct_fijo, 5500000, date(2022, 5, 16), city_ib, bog, eps_sanit, afp_porv, '0142789300020', 365),
        ]
        for row in staff:
            ced, fn, sn, pl, sl, em, dname, pname, cck, sck, ct, sal, sd, bcity, rcity, eps, afp, acc, days_end = row
            d = depts[dname]
            p = pos_by_name[pname]
            cc = ccs[cck]
            sc = SubCostCenter.objects.filter(tenant=tenant, cost_center=cc, name=sck).first()
            if not sc:
                continue
            emp, ced_created = Employee.objects.get_or_create(
                tenant=tenant, document_number=ced,
                defaults={
                    'document_type': doc_type,
                    'first_name': fn, 'second_name': sn, 'first_last_name': pl, 'second_last_name': sl,
                    'email': em,
                    'department': d, 'birth_country': co, 'residence_country': co,
                    'birth_city': bcity, 'residence_city': rcity, 'status': 'active',
                },
            )
            if ced_created:
                self.stats['employees'] += 1
            if not Contract.objects.filter(tenant=tenant, employee=emp, is_current=True).exists():
                end = (sd + timedelta(days=days_end)) if days_end else None
                Contract.objects.create(
                    tenant=tenant, employee=emp, contract_type=ct,
                    start_date=sd, end_date=end, hiring_city=rcity,
                    salary=Decimal(sal), salary_type=st_ord, salary_mode='fixed',
                    position=p, cost_center=cc, sub_cost_center=sc, work_location=wl1, work_center=wcx,
                    eps=eps, afp=afp, ccf=ccf_c, severance_fund=ces, contributor_type=contrib,
                    bank=bank_bc if ced % 2 == 1 else bank_bog, bank_account_number=acc, bank_account_type='Ahorros',
                    is_current=True, contract_status=1,
                )
                self.stats['contracts'] += 1

    def _seed_hiring(self, tenant):
        from apps.personnel.models import Department, Employee
        from apps.hiring.models import (
            HiringProcess, Candidate, OnboardingChecklist, OnboardingTask,
        )

        d_hr = Department.objects.get(tenant=tenant, name='Recursos Humanos')
        d_ti = Department.objects.get(tenant=tenant, name='Tecnología')
        d_com = Department.objects.get(tenant=tenant, name='Comercial')
        d_ops = Department.objects.get(tenant=tenant, name='Operaciones')
        an_rrhh = Employee.objects.filter(
            tenant=tenant, first_last_name='Cárdenas', document_number=1024509003,
        ).first()
        an_rrhh = an_rrhh or Employee.objects.filter(tenant=tenant, status='active').first()

        checklist, c = OnboardingChecklist.objects.get_or_create(
            tenant=tenant, name='Onboarding General Demo',
            defaults={'description': 'Checklist estándar de inducción', 'is_default': True},
        )
        for title, order in [
            ('Entrega de equipos de trabajo', 1),
            ('Firma de contrato y documentos', 2),
            ('Inducción a la empresa y valores', 3),
            ('Accesos a sistemas y herramientas', 4),
            ('Presentación al equipo', 5),
        ]:
            OnboardingTask.objects.get_or_create(
                tenant=tenant, checklist=checklist, title=title,
                defaults={'order': order, 'days_to_complete': 5},
            )
        procs = [
            ('Analista de RRHH Senior', d_hr, 'open', 2, 'Proceso 1: abierto, 5 postulantes', [
                ('Sandra Milena Pinto López', 'sandra.pinto.rrhh@postulante.co', '310 5550101', 'applied'),
                ('Oscar David Peña Mora', 'oscar.pena.rrhh@postulante.co', '300 5550102', 'applied'),
                ('Natalia Rojas Mejía', 'natalia.rojas.rr@postulante.co', '310 5550103', 'interview'),
                ('César Augusto Díaz', 'cesar.diaz.rr@postulante.co', '315 5550104', 'offer'),
                ('Juliana Sánchez Arango', 'juliana.sa.rech@postulante.co', '300 5550105', 'rejected'),
            ]),
            ('Desarrollador Backend Python', d_ti, 'open', 2, 'Proceso 2: abierto, 4 postulantes', [
                ('Felipe Roldán Téllez', 'felipe.r.oldan@dev.co', '320 5550201', 'applied'),
                ('Luisa Fernanda Cote', 'lfcote.dev@postulante.co', '311 5550202', 'interview'),
                ('Emanuel Muñoz', 'e.munoz.py@postulante.co', '300 5550203', 'interview'),
                ('Caridad Vélez Pardo', 'c.velez.dev@postulante.co', '350 5550204', 'offer'),
            ]),
            ('Coordinador Comercial', d_com, 'filled', 1, 'Proceso 3: cerrado', [
                ('Ricardo León Márquez', 'r.leon.hired@postulante.co', '310 5550301', 'hired'),
                ('Diana Cepeda', 'diana.ce@postulante.co', '320 5550302', 'rejected'),
                ('Fabián Tovar López', 'f.tovar@postulante.co', '300 5550303', 'rejected'),
            ]),
            ('Auxiliar de Operaciones', d_ops, 'open', 2, 'Proceso 4: abierto, 3 postulantes', [
                ('Yuly Andrea Garzón', 'yuly.g@postulante.co', '300 5550401', 'applied'),
                ('Wilson Betancur', 'wb.oper@postulante.co', '320 5550402', 'applied'),
                ('Cindy Lorena Mora', 'cindy.mora@postulante.co', '310 5550403', 'interview'),
            ]),
        ]
        nproc = 0
        ncand = 0
        for title, dept, st, pcount, note, cands in procs:
            pr, c = HiringProcess.objects.get_or_create(
                tenant=tenant, position_title=title, defaults={
                    'department': dept, 'requested_by': 'Dirección',
                    'status': st, 'positions_count': pcount, 'notes': note,
                },
            )
            if c:
                nproc += 1
            for fn, em, ph, cst in cands:
                o, c2 = Candidate.objects.get_or_create(
                    tenant=tenant, hiring_process=pr, email=em,
                    defaults={'full_name': fn, 'phone': ph.replace(' ', ''), 'status': cst},
                )
                if c2:
                    ncand += 1
        self.stats['hiring_processes'] = HiringProcess.objects.filter(tenant=tenant).count()
        self.stats['candidates'] = Candidate.objects.filter(tenant=tenant).count()
        self.stats['hiring'] = nproc + ncand
        _ = an_rrhh

    def _seed_quality(self, tenant):
        from datetime import date as ddate
        from apps.personnel.models import Department, Employee
        from apps.quality.models import (
            QualityProcess, InternalAudit, AuditFinding, NonConformity, ContinuousImprovement,
        )

        d_hr = Department.objects.get(tenant=tenant, name='Recursos Humanos')
        owner = Employee.objects.filter(tenant=tenant, document_number=1024509003).first()
        if not owner:
            owner = Employee.objects.filter(tenant=tenant, status='active').first()
        if not owner:
            return
        today = ddate.today()
        tmo = today - timedelta(days=60)
        tmo = tmo.replace(day=1) if tmo.day > 28 else tmo

        qp_specs = [
            ('PR-SEL-001', 'Gestión de Selección y Contratación', 'active', '1.0'),
            ('PR-NOM-001', 'Gestión de Nómina y Compensación', 'active', '1.0'),
            ('PR-BEN-001', 'Gestión de Bienestar Laboral', 'active', '1.0'),
        ]
        procs = {}
        for code, name, st, ver in qp_specs:
            p, c = QualityProcess.objects.get_or_create(
                tenant=tenant, code=code, defaults={
                    'name': name, 'status': st, 'version': ver,
                    'owner': owner, 'department': d_hr, 'effective_date': today,
                },
            )
            procs[code] = p
            if c:
                self.stats['q_processes'] += 1

        aud, c = InternalAudit.objects.get_or_create(
            tenant=tenant, code='AUD-DEMO-2025-01',
            defaults={
                'process': procs['PR-SEL-001'],
                'auditor': owner,
                'planned_date': tmo, 'executed_date': tmo, 'status': 'completed',
                'scope': 'Cobertura SGC selección: revisión de expedientes 2024',
                'conclusions': 'Cierre con dos hallazgos documentados. Seguimiento NC.',
            },
        )
        if c:
            self.stats['audits'] += 1
        AuditFinding.objects.get_or_create(
            tenant=tenant, audit=aud, description='Falta trazabilidad en una versión de formato.',
            defaults={'finding_type': 'observation', 'clause': '7.5.3'},
        )
        AuditFinding.objects.get_or_create(
            tenant=tenant, audit=aud, description='Inconsistencia en retención de documentos de referencia.',
            defaults={'finding_type': 'nonconformity_minor', 'clause': '7.1.5'},
        )
        self.stats['findings'] = AuditFinding.objects.filter(tenant=tenant, audit=aud).count()

        ncs = [
            ('NC-DEM-2025-01', 'audit', 'Retraso en cierre de acciones de un formato de entrevista', 'in_progress', None),
            ('NC-DEM-2025-02', 'process', 'Checklist de inducción sin firma de conformidad (histórico)', 'closed', timezone.now()),
        ]
        for code, source, desc, nst, closed_at in ncs:
            dfd = {
                'source': source, 'description': desc, 'status': nst, 'responsible': owner, 'due_date': today + timedelta(days=20),
            }
            if nst == 'closed' and closed_at:
                dfd['closed_at'] = closed_at
                dfd['effectiveness_verified'] = True
            NonConformity.objects.update_or_create(
                tenant=tenant, code=code, defaults=dfd,
            )

        ci, c3 = ContinuousImprovement.objects.get_or_create(
            tenant=tenant, code='CI-ONB-2025-01', defaults={
                'title': 'Digitalización de proceso de onboarding',
                'description': 'Herramienta digital y firma electrónica para agilizar ingreso de personal',
                'process': procs.get('PR-SEL-001'), 'proposed_by': owner, 'responsible': owner,
                'status': 'in_progress', 'priority': 'high',
            },
        )
        if c3:
            self.stats['improvements'] += 1
        _ = ci

    def _seed_performance(self, tenant):
        from apps.personnel.models import Department, Employee
        from apps.performance.models import (
            OKRPeriod, Objective, KeyResult, KPI, KPIMeasurement,
        )

        d_hr = Department.objects.get(tenant=tenant, name='Recursos Humanos')
        emp_hr = Employee.objects.filter(
            tenant=tenant, first_last_name='Cárdenas', document_number=1024509003,
        ).first() or Employee.objects.filter(tenant=tenant, status='active').first()
        if not emp_hr:
            return
        p1, c1 = OKRPeriod.objects.get_or_create(
            tenant=tenant, name='Q1 2025', defaults={
                'start_date': date(2025, 1, 1), 'end_date': date(2025, 3, 31), 'is_active': False,
            },
        )
        p2, c2 = OKRPeriod.objects.get_or_create(
            tenant=tenant, name='Q2 2025', defaults={
                'start_date': date(2025, 4, 1), 'end_date': date(2025, 6, 30), 'is_active': True,
            },
        )
        OKRPeriod.objects.filter(tenant=tenant).update(is_active=False)
        p2 = OKRPeriod.objects.get(tenant=tenant, name='Q2 2025')
        OKRPeriod.objects.filter(tenant=tenant, pk=p2.pk).update(is_active=True)
        if c1 or c2:
            self.stats['okr_periods'] = OKRPeriod.objects.filter(tenant=tenant).count()
        period = p2
        o1, _ = Objective.objects.get_or_create(
            tenant=tenant, period=period, title='Alcanzar 95% de satisfacción en clima laboral', level='company',
            defaults={'description': 'Medición anual e hitos', 'status': 'active', 'weight': Decimal('100')},
        )
        o2, _ = Objective.objects.get_or_create(
            tenant=tenant, period=period, title='Reducir rotación de personal a menos del 5%',
            level='company', defaults={'description': 'Rotación 12M', 'status': 'active', 'weight': Decimal('100')},
        )
        o3, _ = Objective.objects.get_or_create(
            tenant=tenant, period=period, title='Completar selección en máximo 30 días', level='department',
            department=d_hr, parent=o1, defaults={'status': 'active', 'weight': Decimal('100')},
        )
        o4, _ = Objective.objects.get_or_create(
            tenant=tenant, period=period, title='Implementar programa de bienestar Q2', level='department',
            department=d_hr, parent=o2, defaults={'status': 'active', 'weight': Decimal('100')},
        )
        o5, _ = Objective.objects.get_or_create(
            tenant=tenant, period=period, title='Gestionar 4 procesos de selección simultáneos',
            level='individual', owner=emp_hr, parent=o3, defaults={'status': 'active', 'weight': Decimal('100')},
        )
        for obj, data in [
            (o1, [
                ('Encuesta clima Q2 (meta 95% respuestas)', 95, 68, 0, 50, 'percentage', '%'),
                ('NPS clima 1-10', 10, 6.5, 0, 30, 'number', 'pts'),
            ]),
            (o2, [
                ('Rotación 12M vs meta 5%', 5, 3.2, 0, 100, 'percentage', '%'),
            ]),
            (o3, [
                ('Días p95 de contratación bajo 30 días', 30, 22, 0, 100, 'number', 'días'),
            ]),
            (o4, [
                ('Iniciativas de bienestar lanzadas (meta 3)', 3, 1, 0, 100, 'number', 'n'),
            ]),
            (o5, [
                ('Procesos de selección en paralelo (meta 4)', 4, 2, 0, 100, 'number', 'n'),
            ]),
        ]:
            for title, target, current, start, wgt, mtype, unit in data:
                kr, kc = KeyResult.objects.get_or_create(
                    tenant=tenant, objective=obj, title=title,
                    defaults={
                        'target_value': Decimal(str(target)), 'current_value': Decimal(str(current)), 'start_value': Decimal(str(start)),
                        'metric_type': mtype, 'unit': unit, 'weight': Decimal(str(wgt)), 'responsible': emp_hr,
                    },
                )
                if kc:
                    self.stats['key_results'] += 1
        self.stats['objectives'] = Objective.objects.filter(tenant=tenant, period=period).count()
        for name, tunit, target, mtype, vals in [
            ('Tiempo promedio de contratación', 'días', 30, 'number', (32, 28, 25)),
            ('Índice de rotación mensual', '%', 5, 'percentage', (6, 4.5, 4)),
            ('NPS del proceso de onboarding', 'pts', 80, 'number', (70, 75, 78)),
        ]:
            k, kc2 = KPI.objects.get_or_create(
                tenant=tenant, name=f'{name} (demo)', defaults={
                    'description': 'Indicador demo', 'target_value': Decimal(str(target)), 'unit': tunit, 'metric_type': mtype, 'department': d_hr, 'owner': emp_hr, 'frequency': 'monthly', 'is_active': True,
                },
            )
            if not kc2 and k:
                k.target_value = Decimal(str(target))
                k.save(update_fields=['target_value', 'updated_at'])
            for i, (vd, v) in enumerate(
                [
                    (date(2025, 4, 1), vals[0]), (date(2025, 5, 1), vals[1]), (date(2025, 6, 1), vals[2]),
                ],
            ):
                m, c = KPIMeasurement.objects.get_or_create(
                    tenant=tenant, kpi=k, period_date=vd,
                    defaults={'period_label': f'{vd.year}-{vd.month:02d}', 'value': Decimal(str(v)), 'recorded_by': 'seed_dev'},
                )
                if c:
                    self.stats['kpi_measures'] += 1
        self.stats['kpis'] = KPI.objects.filter(tenant=tenant, name__contains='(demo)').count()
        # KeyResult - fix duplicate if re-run: title unique in objective
        if self.stats['key_results'] == 0 and KeyResult.objects.filter(tenant=tenant).exists():
            self.stats['key_results'] = KeyResult.objects.filter(tenant=tenant, objective__period=period).count()
        if self.stats['objectives'] == 0:
            self.stats['objectives'] = Objective.objects.filter(tenant=tenant, period=period).count()

    def _print_summary(self):
        s = self.stats
        # Recount globals if empty
        from apps.catalogs.models import Bank, SocialSecurityEntity, SocialSecurityEntityType
        if s['banks'] == 0:
            s['banks'] = Bank.objects.filter(is_active=True).count()
        s['eps'] = s['eps'] or SocialSecurityEntity.objects.filter(entity_type=SocialSecurityEntityType.EPS, is_active=True).count()
        s['afp'] = s['afp'] or SocialSecurityEntity.objects.filter(entity_type=SocialSecurityEntityType.AFP, is_active=True).count()
        s['arl'] = s['arl'] or SocialSecurityEntity.objects.filter(entity_type=SocialSecurityEntityType.ARL, is_active=True).count()
        s['ccf'] = s['ccf'] or SocialSecurityEntity.objects.filter(entity_type=SocialSecurityEntityType.CCF, is_active=True).count()
        s['ces'] = s['ces'] or SocialSecurityEntity.objects.filter(entity_type=SocialSecurityEntityType.CESANTIAS, is_active=True).count()
        t = Tenant.objects.get(slug=DEMO_TENANT_SLUG)
        from apps.catalogs.models import (
            CostCenter, OrganizationalLevel, Position, SubCostCenter, WorkLocation, WorkCenter,
        )
        from apps.personnel.models import Contract, Department, Employee
        from apps.hiring.models import HiringProcess, Candidate
        from apps.quality.models import QualityProcess, InternalAudit, NonConformity, ContinuousImprovement
        from apps.performance.models import OKRPeriod, Objective, KeyResult, KPI, KPIMeasurement
        self.stdout.write(
            f'\n=== SEED DEMO COMPANY COMPLETADO ===\n'
            f'Catálogos globales:\n'
            f'  Bancos: {s["banks"]} | EPS: {s["eps"]} | AFP: {s["afp"]} | ARL: {s["arl"]} | CCF: {s["ccf"]} | Cesantías: {s["ces"]}\n'
            f'Catálogos tenant {DEMO_TENANT_NAME}:\n'
            f'  Niveles org: {OrganizationalLevel.objects.filter(tenant=t).count()} | Depts: {Department.objects.filter(tenant=t).count()} | Cargos: {Position.objects.filter(tenant=t).count()}\n'
            f'  Centros de costo: {CostCenter.objects.filter(tenant=t).count()} | Sub-centros: {SubCostCenter.objects.filter(tenant=t).count()}\n'
            f'  Sedes: {WorkLocation.objects.filter(tenant=t).count()} | Centros de trabajo: {WorkCenter.objects.filter(tenant=t).count()}\n'
        )
        self.stdout.write(
            f'Datos operacionales (tenant {DEMO_TENANT_SLUG}):\n'
            f'  Empleados: {Employee.objects.filter(tenant=t).count()} | Contratos actuales: {Contract.objects.filter(tenant=t, is_current=True).count()}\n'
            f'  Procesos hiring: {HiringProcess.objects.filter(tenant=t).count()} | Candidatos: {Candidate.objects.filter(tenant=t).count()}\n'
            f'  Procesos quality: {QualityProcess.objects.filter(tenant=t).count()} | Auditorías: {InternalAudit.objects.filter(tenant=t).count()} | NC: {NonConformity.objects.filter(tenant=t).count()} | Mejoras: {ContinuousImprovement.objects.filter(tenant=t).count()}\n'
            f'  OKR Periods: {OKRPeriod.objects.filter(tenant=t).count()} | Objetivos: {Objective.objects.filter(tenant=t).count()} | KRs: {KeyResult.objects.filter(tenant=t).count()}\n'
            f'  KPIs: {KPI.objects.filter(tenant=t).count()} | Mediciones KPI: {KPIMeasurement.objects.filter(tenant=t).count()}\n'
            f'=====================================\n',
        )
