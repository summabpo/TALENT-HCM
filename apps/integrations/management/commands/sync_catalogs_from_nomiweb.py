import logging
from django.core.management.base import BaseCommand
from django.db import connection
from apps.integrations.nomiweb_client import NomiwebClient, NomiwebAPIError
from apps.catalogs.models import (
    SocialSecurityEntity, Bank, DocumentType,
    ContributorType, ContributorSubtype,
)

logger = logging.getLogger('integrations.catalog_sync')

# Nomiweb tipoentidad values that map to HCM entity_type choices
_ENTITY_TYPE_MAP = {
    'EPS': 'EPS',
    'AFP': 'AFP',
    'ARL': 'ARL',
    'CCF': 'CCF',
    'CESANTIAS': 'CESANTIAS',
}


class Command(BaseCommand):
    help = 'Importa catálogos globales desde Nomiweb con códigos reales PILA'

    def add_arguments(self, parser):
        parser.add_argument(
            '--catalogo',
            choices=['all', 'entidades', 'bancos', 'documentos', 'cotizantes'],
            default='all',
            help='Catálogo específico a sincronizar',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Solo mostrar qué se haría, sin guardar',
        )

    def handle(self, *args, **options):
        self.client = NomiwebClient()
        self.dry_run = options['dry_run']
        self.stats = {}
        catalogo = options['catalogo']

        if self.dry_run:
            self.stdout.write(self.style.WARNING('=== MODO DRY-RUN (sin cambios) ==='))
        else:
            self._reset_sequences()

        if catalogo in ('all', 'entidades'):
            self.sync_entidades_seg_social()

        if catalogo in ('all', 'bancos'):
            self.sync_bancos()

        if catalogo in ('all', 'documentos'):
            self.sync_tipos_documento()

        if catalogo in ('all', 'cotizantes'):
            self.sync_tipos_cotizante()
            self.sync_subtipos_cotizante()

        self._print_summary()

    def sync_entidades_seg_social(self):
        """
        Sincroniza entidades de seguridad social desde Nomiweb.

        Campos reales Nomiweb:
          codigo     → SocialSecurityEntity.code
          entidad    → SocialSecurityEntity.name
          tipoentidad→ SocialSecurityEntity.entity_type (EPS/AFP/ARL/CCF)
          nit        → SocialSecurityEntity.nit  (ej: "900462447-5", max 11 chars)
          codsgp     → SocialSecurityEntity.sgp_code

        Skips: PARAFISCALES, '0' (not in HCM entity_type choices)
        """
        self.stdout.write('Sincronizando entidades de seguridad social...')
        stats = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': 0}

        try:
            entidades = self.client.get_entidades_seg_social()
        except NomiwebAPIError as e:
            self.stderr.write(f'  Error obteniendo entidades: {e}')
            self.stats['entidades'] = {'error': str(e)}
            return

        for ent in entidades:
            try:
                codigo = ent.get('codigo', '').strip()
                tipoentidad = ent.get('tipoentidad', '')
                entity_type = _ENTITY_TYPE_MAP.get(tipoentidad)

                if not codigo or not entity_type:
                    stats['skipped'] += 1
                    continue

                nombre = ent.get('entidad', '').strip()
                nit = (ent.get('nit') or '').strip()[:12]
                sgp_code = (ent.get('codsgp') or '').strip()[:10]

                if self.dry_run:
                    self.stdout.write(f'  [DRY] {entity_type} {codigo}: {nombre}')
                    stats['updated'] += 1
                    continue

                obj, created = SocialSecurityEntity.objects.update_or_create(
                    code=codigo,
                    defaults={
                        'name': nombre,
                        'entity_type': entity_type,
                        'nit': nit,
                        'sgp_code': sgp_code,
                    },
                )
                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1

            except Exception as e:
                stats['errors'] += 1
                logger.error(f'Error entidad {ent}: {e}')

        self.stats['entidades'] = stats
        self.stdout.write(
            f'  Entidades SS: +{stats["created"]} creadas, '
            f'~{stats["updated"]} actualizadas, '
            f'-{stats["skipped"]} omitidas, '
            f'✗{stats["errors"]} errores'
        )

    def sync_bancos(self):
        """
        Sincroniza bancos desde Nomiweb.

        Campos reales Nomiweb:
          codbanco → Bank.code
          nombanco → Bank.name
          codach   → Bank.ach_code
          nitbanco → Bank.nit
        """
        self.stdout.write('Sincronizando bancos...')
        stats = {'created': 0, 'updated': 0, 'errors': 0}

        try:
            bancos = self.client.get_bancos()
        except NomiwebAPIError as e:
            self.stderr.write(f'  Error obteniendo bancos: {e}')
            self.stats['bancos'] = {'error': str(e)}
            return

        for banco in bancos:
            try:
                codbanco = str(banco.get('codbanco', '')).strip()
                nombanco = (banco.get('nombanco') or '').strip()

                if not codbanco:
                    continue

                if self.dry_run:
                    self.stdout.write(f'  [DRY] {codbanco}: {nombanco}')
                    stats['updated'] += 1
                    continue

                obj, created = Bank.objects.update_or_create(
                    code=codbanco,
                    defaults={
                        'name': nombanco,
                        'ach_code': (banco.get('codach') or '')[:10],
                        'nit': (banco.get('nitbanco') or '')[:20],
                    },
                )
                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1

            except Exception as e:
                stats['errors'] += 1
                logger.error(f'Error banco {banco}: {e}')

        self.stats['bancos'] = stats
        self.stdout.write(
            f'  Bancos: +{stats["created"]} creados, ~{stats["updated"]} actualizados'
        )

    def sync_tipos_documento(self):
        """
        Sincroniza tipos de documento desde Nomiweb.

        Campos reales Nomiweb:
          codigo   → DocumentType.code  (CC, CE, TI, etc.)
          documento→ DocumentType.name
          cod_dian → DocumentType.dian_code
        """
        self.stdout.write('Sincronizando tipos de documento...')
        stats = {'created': 0, 'updated': 0, 'errors': 0}

        try:
            tipos = self.client.get_tipos_documento()
        except NomiwebAPIError as e:
            self.stderr.write(f'  Error obteniendo tipos documento: {e}')
            self.stats['documentos'] = {'error': str(e)}
            return

        for tipo in tipos:
            try:
                codigo = (tipo.get('codigo') or '').strip()
                nombre = (tipo.get('documento') or '').strip()

                if not codigo:
                    continue

                if self.dry_run:
                    self.stdout.write(f'  [DRY] {codigo}: {nombre}')
                    stats['updated'] += 1
                    continue

                obj, created = DocumentType.objects.update_or_create(
                    code=codigo,
                    defaults={
                        'name': nombre,
                        'dian_code': tipo.get('cod_dian'),
                    },
                )
                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1

            except Exception as e:
                stats['errors'] += 1
                logger.error(f'Error tipo documento {tipo}: {e}')

        self.stats['documentos'] = stats
        self.stdout.write(
            f'  Tipos documento: +{stats["created"]} creados, ~{stats["updated"]} actualizados'
        )

    def sync_tipos_cotizante(self):
        """
        Sincroniza tipos de cotizante (PILA) desde Nomiweb.

        Campos reales Nomiweb:
          tipocotizante  → ContributorType.code  (PK, "01", "02", etc.)
          descripcioncot → ContributorType.description
          codplanilla    → ContributorType.form_code
        """
        self.stdout.write('Sincronizando tipos de cotizante...')
        stats = {'created': 0, 'updated': 0, 'errors': 0}

        try:
            tipos = self.client.get_tipos_cotizante()
        except NomiwebAPIError as e:
            self.stderr.write(f'  Error obteniendo tipos cotizante: {e}')
            self.stats['cotizantes'] = {'error': str(e)}
            return

        for tipo in tipos:
            try:
                codigo = str(tipo.get('tipocotizante', '')).strip()
                descripcion = (tipo.get('descripcioncot') or '').strip()

                if not codigo or len(codigo) > 2:
                    continue

                if self.dry_run:
                    self.stdout.write(f'  [DRY] cotizante {codigo}: {descripcion}')
                    stats['updated'] += 1
                    continue

                # code is PK — update_or_create handles create/update
                obj, created = ContributorType.objects.update_or_create(
                    code=codigo,
                    defaults={
                        'description': descripcion[:120],
                        'form_code': tipo.get('codplanilla'),
                    },
                )
                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1

            except Exception as e:
                stats['errors'] += 1
                logger.error(f'Error tipo cotizante {tipo}: {e}')

        self.stats['cotizantes'] = stats
        self.stdout.write(
            f'  Tipos cotizante: +{stats["created"]} creados, ~{stats["updated"]} actualizados'
        )

    def sync_subtipos_cotizante(self):
        """
        Sincroniza subtipos de cotizante desde Nomiweb.

        Campos reales Nomiweb:
          subtipocotizante → ContributorSubtype.code  (PK, "0", "1", "11", etc.)
          descripcion      → ContributorSubtype.description
          codplanilla      → ContributorSubtype.form_code
        """
        self.stdout.write('Sincronizando subtipos de cotizante...')
        stats = {'created': 0, 'updated': 0, 'errors': 0}

        try:
            subtipos = self.client.get_subtipos_cotizante()
        except NomiwebAPIError as e:
            self.stderr.write(f'  Error obteniendo subtipos cotizante: {e}')
            self.stats['subtipos'] = {'error': str(e)}
            return

        for subtipo in subtipos:
            try:
                codigo = str(subtipo.get('subtipocotizante', '')).strip()
                descripcion = (subtipo.get('descripcion') or '').strip()

                if not codigo or len(codigo) > 2:
                    continue

                if self.dry_run:
                    self.stdout.write(f'  [DRY] subtipo {codigo}: {descripcion}')
                    stats['updated'] += 1
                    continue

                obj, created = ContributorSubtype.objects.update_or_create(
                    code=codigo,
                    defaults={
                        'description': descripcion[:100],
                        'form_code': subtipo.get('codplanilla'),
                    },
                )
                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1

            except Exception as e:
                stats['errors'] += 1
                logger.error(f'Error subtipo cotizante {subtipo}: {e}')

        self.stats['subtipos'] = stats
        self.stdout.write(
            f'  Subtipos cotizante: +{stats["created"]} creados, ~{stats["updated"]} actualizados'
        )

    def _reset_sequences(self):
        """Resynchronize PostgreSQL auto-increment sequences for catalog tables."""
        tables = [
            'catalog_social_security_entity',
            'catalog_bank',
            'catalog_document_type',
        ]
        with connection.cursor() as cursor:
            for table in tables:
                cursor.execute(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM "{table}"), 0) + 1,
                        false
                    )
                """)

    def _print_summary(self):
        self.stdout.write('\n=== RESUMEN ===')
        total_created = total_updated = total_errors = 0

        for catalogo, stats in self.stats.items():
            if isinstance(stats, dict) and 'error' not in stats:
                c = stats.get('created', 0)
                u = stats.get('updated', 0)
                e = stats.get('errors', 0)
                total_created += c
                total_updated += u
                total_errors += e
                self.stdout.write(f'  {catalogo}: +{c} creados, ~{u} actualizados, ✗{e} errores')
            elif isinstance(stats, dict) and 'error' in stats:
                self.stdout.write(
                    self.style.ERROR(f'  {catalogo}: ERROR — {stats["error"]}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nTotal: +{total_created} creados, ~{total_updated} actualizados, '
                f'✗{total_errors} errores'
            )
        )

        if self.dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY-RUN] No se guardaron cambios.'))
