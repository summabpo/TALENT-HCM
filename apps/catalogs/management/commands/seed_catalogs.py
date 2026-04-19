from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Seed global catalog data (countries, cities, document types, SS entities, etc.)'

    def handle(self, *args, **options):
        self.stdout.write('Seeding catalogs...')
        self._seed_countries()
        self._seed_document_types()
        self._seed_contract_types()
        self._seed_salary_types()
        self.stdout.write(self.style.SUCCESS('Catalog seeding complete.'))

    def _seed_countries(self):
        from apps.catalogs.models import Country
        countries = [
            {'id': 1, 'name': 'Colombia', 'iso_code': 'CO'},
        ]
        for data in countries:
            Country.objects.update_or_create(id=data['id'], defaults=data)
        self.stdout.write(f'  Countries: {len(countries)}')

    def _seed_document_types(self):
        from apps.catalogs.models import DocumentType
        types = [
            {'id': 1, 'code': 'CC', 'name': 'Cédula de Ciudadanía', 'dian_code': 13},
            {'id': 2, 'code': 'CE', 'name': 'Cédula de Extranjería', 'dian_code': 22},
            {'id': 3, 'code': 'PA', 'name': 'Pasaporte', 'dian_code': 41},
            {'id': 4, 'code': 'TI', 'name': 'Tarjeta de Identidad', 'dian_code': 12},
            {'id': 5, 'code': 'NIT', 'name': 'NIT', 'dian_code': 31},
            {'id': 6, 'code': 'PE', 'name': 'Permiso Especial de Permanencia', 'dian_code': None},
        ]
        for data in types:
            DocumentType.objects.update_or_create(id=data['id'], defaults=data)
        self.stdout.write(f'  Document types: {len(types)}')

    def _seed_contract_types(self):
        from apps.catalogs.models import ContractType
        types = [
            {'id': 1, 'name': 'Término Indefinido', 'dian_code': 1},
            {'id': 2, 'name': 'Término Fijo', 'dian_code': 2},
            {'id': 3, 'name': 'Obra o Labor', 'dian_code': 4},
            {'id': 4, 'name': 'Aprendizaje', 'dian_code': 5},
            {'id': 5, 'name': 'Prestación de Servicios', 'dian_code': None},
        ]
        for data in types:
            ContractType.objects.update_or_create(id=data['id'], defaults=data)
        self.stdout.write(f'  Contract types: {len(types)}')

    def _seed_salary_types(self):
        from apps.catalogs.models import SalaryType
        types = [
            {'id': 1, 'name': 'Ordinario'},
            {'id': 2, 'name': 'Integral'},
        ]
        for data in types:
            SalaryType.objects.update_or_create(id=data['id'], defaults=data)
        self.stdout.write(f'  Salary types: {len(types)}')
