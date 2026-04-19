from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Seed global catalog data (countries, document types, SS entities, contributor types, banks, etc.)'

    def handle(self, *args, **options):
        self.stdout.write('Seeding catalogs...')
        self._seed_countries()
        self._seed_states()
        self._seed_cities()
        self._seed_document_types()
        self._seed_contract_types()
        self._seed_salary_types()
        self._seed_contributor_types()
        self._seed_contributor_subtypes()
        self._seed_social_security_entities()
        self._seed_banks()
        self._seed_absence_types()
        self.stdout.write(self.style.SUCCESS('Catalog seeding complete.'))

    def _seed_countries(self):
        from apps.catalogs.models import Country
        data = [
            {'id': 1, 'name': 'Colombia', 'iso_code': 'CO'},
            {'id': 2, 'name': 'Venezuela', 'iso_code': 'VE'},
            {'id': 3, 'name': 'Ecuador', 'iso_code': 'EC'},
            {'id': 4, 'name': 'Perú', 'iso_code': 'PE'},
            {'id': 5, 'name': 'México', 'iso_code': 'MX'},
            {'id': 6, 'name': 'España', 'iso_code': 'ES'},
            {'id': 7, 'name': 'Estados Unidos', 'iso_code': 'US'},
        ]
        for row in data:
            Country.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Countries: {len(data)}')

    def _seed_states(self):
        from apps.catalogs.models import StateProvince
        data = [
            {'id': 1, 'name': 'Bogotá D.C.', 'code': '11', 'country_id': 1},
            {'id': 2, 'name': 'Antioquia', 'code': '05', 'country_id': 1},
            {'id': 3, 'name': 'Valle del Cauca', 'code': '76', 'country_id': 1},
            {'id': 4, 'name': 'Cundinamarca', 'code': '25', 'country_id': 1},
            {'id': 5, 'name': 'Atlántico', 'code': '08', 'country_id': 1},
            {'id': 6, 'name': 'Santander', 'code': '68', 'country_id': 1},
            {'id': 7, 'name': 'Bolívar', 'code': '13', 'country_id': 1},
            {'id': 8, 'name': 'Córdoba', 'code': '23', 'country_id': 1},
            {'id': 9, 'name': 'Nariño', 'code': '52', 'country_id': 1},
            {'id': 10, 'name': 'Boyacá', 'code': '15', 'country_id': 1},
        ]
        for row in data:
            StateProvince.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  States/Departments: {len(data)}')

    def _seed_cities(self):
        from apps.catalogs.models import City
        data = [
            {'id': 1, 'name': 'Bogotá D.C.', 'code': '11001', 'state_province_id': 1},
            {'id': 2, 'name': 'Medellín', 'code': '05001', 'state_province_id': 2},
            {'id': 3, 'name': 'Cali', 'code': '76001', 'state_province_id': 3},
            {'id': 4, 'name': 'Barranquilla', 'code': '08001', 'state_province_id': 5},
            {'id': 5, 'name': 'Bucaramanga', 'code': '68001', 'state_province_id': 6},
            {'id': 6, 'name': 'Cartagena', 'code': '13001', 'state_province_id': 7},
            {'id': 7, 'name': 'Cúcuta', 'code': '54001', 'state_province_id': 6},
            {'id': 8, 'name': 'Pereira', 'code': '66001', 'state_province_id': 3},
            {'id': 9, 'name': 'Manizales', 'code': '17001', 'state_province_id': 2},
            {'id': 10, 'name': 'Ibagué', 'code': '73001', 'state_province_id': 4},
            {'id': 11, 'name': 'Bello', 'code': '05088', 'state_province_id': 2},
            {'id': 12, 'name': 'Soledad', 'code': '08758', 'state_province_id': 5},
            {'id': 13, 'name': 'Villavicencio', 'code': '50001', 'state_province_id': 4},
            {'id': 14, 'name': 'Santa Marta', 'code': '47001', 'state_province_id': 5},
            {'id': 15, 'name': 'Montería', 'code': '23001', 'state_province_id': 8},
        ]
        for row in data:
            City.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Cities: {len(data)}')

    def _seed_document_types(self):
        from apps.catalogs.models import DocumentType
        data = [
            {'id': 1, 'code': 'CC', 'name': 'Cédula de Ciudadanía', 'dian_code': 13},
            {'id': 2, 'code': 'CE', 'name': 'Cédula de Extranjería', 'dian_code': 22},
            {'id': 3, 'code': 'PA', 'name': 'Pasaporte', 'dian_code': 41},
            {'id': 4, 'code': 'TI', 'name': 'Tarjeta de Identidad', 'dian_code': 12},
            {'id': 5, 'code': 'NIT', 'name': 'NIT', 'dian_code': 31},
            {'id': 6, 'code': 'PE', 'name': 'Permiso Especial de Permanencia', 'dian_code': None},
            {'id': 7, 'code': 'PT', 'name': 'Permiso de Protección Temporal', 'dian_code': None},
        ]
        for row in data:
            DocumentType.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Document types: {len(data)}')

    def _seed_contract_types(self):
        from apps.catalogs.models import ContractType
        data = [
            {'id': 1, 'name': 'Término Indefinido', 'dian_code': 1},
            {'id': 2, 'name': 'Término Fijo', 'dian_code': 2},
            {'id': 3, 'name': 'Obra o Labor', 'dian_code': 4},
            {'id': 4, 'name': 'Aprendizaje', 'dian_code': 5},
            {'id': 5, 'name': 'Prestación de Servicios', 'dian_code': None},
        ]
        for row in data:
            ContractType.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Contract types: {len(data)}')

    def _seed_salary_types(self):
        from apps.catalogs.models import SalaryType
        data = [
            {'id': 1, 'name': 'Ordinario'},
            {'id': 2, 'name': 'Integral'},
        ]
        for row in data:
            SalaryType.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Salary types: {len(data)}')

    def _seed_contributor_types(self):
        from apps.catalogs.models import ContributorType
        data = [
            {'code': '00', 'description': 'No aplica', 'form_code': None},
            {'code': '12', 'description': 'Dependiente', 'form_code': 1},
            {'code': '19', 'description': 'Trabajador de tiempo parcial', 'form_code': 1},
            {'code': '23', 'description': 'Independiente voluntario', 'form_code': 3},
            {'code': '47', 'description': 'Dependiente entidad pública', 'form_code': 1},
            {'code': '51', 'description': 'Aprendiz en etapa lectiva', 'form_code': None},
            {'code': '52', 'description': 'Aprendiz en etapa productiva', 'form_code': 1},
            {'code': '55', 'description': 'Independiente agremiado o asociado', 'form_code': 3},
        ]
        for row in data:
            ContributorType.objects.update_or_create(code=row['code'], defaults=row)
        self.stdout.write(f'  Contributor types: {len(data)}')

    def _seed_contributor_subtypes(self):
        from apps.catalogs.models import ContributorSubtype
        data = [
            {'code': '00', 'description': 'No aplica', 'form_code': None},
            {'code': '01', 'description': 'Pensionado que sigue laborando', 'form_code': None},
            {'code': '02', 'description': 'Trabajador en licencia remunerada', 'form_code': None},
            {'code': '03', 'description': 'Trabajador en licencia no remunerada', 'form_code': None},
            {'code': '04', 'description': 'Trabajador en incapacidad EPS', 'form_code': None},
            {'code': '05', 'description': 'Trabajador en incapacidad ARL', 'form_code': None},
            {'code': '06', 'description': 'Trabajador en huelga o suspensión', 'form_code': None},
        ]
        for row in data:
            ContributorSubtype.objects.update_or_create(code=row['code'], defaults=row)
        self.stdout.write(f'  Contributor subtypes: {len(data)}')

    def _seed_social_security_entities(self):
        from apps.catalogs.models import SocialSecurityEntity
        data = [
            # EPS
            {'id': 1, 'code': 'EPS001', 'nit': '800251030', 'name': 'Sura EPS', 'entity_type': 'EPS', 'sgp_code': 'EPS010'},
            {'id': 2, 'code': 'EPS002', 'nit': '900156264', 'name': 'Salud Total EPS', 'entity_type': 'EPS', 'sgp_code': 'EPS017'},
            {'id': 3, 'code': 'EPS003', 'nit': '890903790', 'name': 'Nueva EPS', 'entity_type': 'EPS', 'sgp_code': 'EPS037'},
            {'id': 4, 'code': 'EPS004', 'nit': '891411671', 'name': 'Compensar EPS', 'entity_type': 'EPS', 'sgp_code': 'EPS006'},
            {'id': 5, 'code': 'EPS005', 'nit': '860066942', 'name': 'Sanitas EPS', 'entity_type': 'EPS', 'sgp_code': 'EPS040'},
            # AFP
            {'id': 10, 'code': 'AFP001', 'nit': '860007386', 'name': 'Porvenir AFP', 'entity_type': 'AFP', 'sgp_code': 'FPV004'},
            {'id': 11, 'code': 'AFP002', 'nit': '800088702', 'name': 'Protección AFP', 'entity_type': 'AFP', 'sgp_code': 'FPV005'},
            {'id': 12, 'code': 'AFP003', 'nit': '830002505', 'name': 'Colfondos AFP', 'entity_type': 'AFP', 'sgp_code': 'FPV001'},
            {'id': 13, 'code': 'AFP004', 'nit': '800140949', 'name': 'Old Mutual AFP', 'entity_type': 'AFP', 'sgp_code': 'FPV006'},
            # ARL
            {'id': 20, 'code': 'ARL001', 'nit': '800255742', 'name': 'Sura ARL', 'entity_type': 'ARL', 'sgp_code': 'ARP010'},
            {'id': 21, 'code': 'ARL002', 'nit': '800226402', 'name': 'Positiva ARL', 'entity_type': 'ARL', 'sgp_code': 'ARP016'},
            {'id': 22, 'code': 'ARL003', 'nit': '860002536', 'name': 'Colmena ARL', 'entity_type': 'ARL', 'sgp_code': 'ARP002'},
            # CCF
            {'id': 30, 'code': 'CCF001', 'nit': '860007163', 'name': 'Compensar CCF', 'entity_type': 'CCF', 'sgp_code': 'CCF006'},
            {'id': 31, 'code': 'CCF002', 'nit': '899999040', 'name': 'Colsubsidio CCF', 'entity_type': 'CCF', 'sgp_code': 'CCF009'},
            {'id': 32, 'code': 'CCF003', 'nit': '860007336', 'name': 'Cafam CCF', 'entity_type': 'CCF', 'sgp_code': 'CCF003'},
            {'id': 33, 'code': 'CCF004', 'nit': '890980556', 'name': 'Comfama CCF', 'entity_type': 'CCF', 'sgp_code': 'CCF018'},
            # Cesantías
            {'id': 40, 'code': 'CES001', 'nit': '860007386', 'name': 'Porvenir Cesantías', 'entity_type': 'CESANTIAS', 'sgp_code': 'FCE004'},
            {'id': 41, 'code': 'CES002', 'nit': '800088702', 'name': 'Protección Cesantías', 'entity_type': 'CESANTIAS', 'sgp_code': 'FCE005'},
            {'id': 42, 'code': 'CES003', 'nit': '830002505', 'name': 'Colfondos Cesantías', 'entity_type': 'CESANTIAS', 'sgp_code': 'FCE001'},
        ]
        for row in data:
            SocialSecurityEntity.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Social security entities: {len(data)}')

    def _seed_banks(self):
        from apps.catalogs.models import Bank
        data = [
            {'id': 1, 'name': 'Bancolombia', 'code': '007', 'ach_code': '1007'},
            {'id': 2, 'name': 'Banco de Bogotá', 'code': '001', 'ach_code': '1001'},
            {'id': 3, 'name': 'Davivienda', 'code': '051', 'ach_code': '1051'},
            {'id': 4, 'name': 'BBVA Colombia', 'code': '013', 'ach_code': '1013'},
            {'id': 5, 'name': 'Banco de Occidente', 'code': '023', 'ach_code': '1023'},
            {'id': 6, 'name': 'Nequi', 'code': '507', 'ach_code': ''},
            {'id': 7, 'name': 'Daviplata', 'code': '551', 'ach_code': ''},
            {'id': 8, 'name': 'Scotiabank Colpatria', 'code': '019', 'ach_code': '1019'},
            {'id': 9, 'name': 'Banco Agrario', 'code': '040', 'ach_code': '1040'},
            {'id': 10, 'name': 'Banco Popular', 'code': '002', 'ach_code': '1002'},
        ]
        for row in data:
            Bank.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Banks: {len(data)}')

    def _seed_absence_types(self):
        from apps.catalogs.models import AbsenceType
        data = [
            {'id': 1, 'name': 'Enfermedad General'},
            {'id': 2, 'name': 'Accidente de Trabajo'},
            {'id': 3, 'name': 'Enfermedad Profesional'},
            {'id': 4, 'name': 'Maternidad'},
            {'id': 5, 'name': 'Paternidad'},
            {'id': 6, 'name': 'Licencia Remunerada'},
            {'id': 7, 'name': 'Licencia No Remunerada'},
            {'id': 8, 'name': 'Vacaciones'},
            {'id': 9, 'name': 'Calamidad Doméstica'},
            {'id': 10, 'name': 'Suspensión'},
        ]
        for row in data:
            AbsenceType.objects.update_or_create(id=row['id'], defaults=row)
        self.stdout.write(f'  Absence types: {len(data)}')
