import requests
import logging
from django.conf import settings

logger = logging.getLogger('integrations.nomiweb')


class NomiwebAPIError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


class NomiwebClient:
    """Cliente HTTP para consumir la API REST de Nomiweb."""

    def __init__(self):
        self.base_url = settings.NOMIWEB_BASE_URL.rstrip('/')
        self.api_key = settings.NOMIWEB_API_KEY
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Api-Key {self.api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        })
        self.timeout = 30

    def _get(self, endpoint, params=None):
        url = f'{self.base_url}/api/v1/{endpoint.lstrip("/")}'
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f'HTTP error GET {url}: {e}')
            raise NomiwebAPIError(str(e), status_code=resp.status_code)
        except requests.exceptions.ConnectionError as e:
            logger.error(f'Connection error GET {url}: {e}')
            raise NomiwebAPIError(f'No se pudo conectar a Nomiweb: {e}')
        except requests.exceptions.Timeout:
            raise NomiwebAPIError(f'Timeout en {url}')

    def _post(self, endpoint, data):
        url = f'{self.base_url}/api/v1/{endpoint.lstrip("/")}'
        try:
            resp = self.session.post(url, json=data, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f'HTTP error POST {url}: {e}')
            raise NomiwebAPIError(str(e), status_code=resp.status_code)

    def _patch(self, endpoint, data):
        url = f'{self.base_url}/api/v1/{endpoint.lstrip("/")}'
        try:
            resp = self.session.patch(url, json=data, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            raise NomiwebAPIError(str(e), status_code=resp.status_code)

    def _get_all_pages(self, endpoint, params=None):
        """Itera todas las páginas y retorna lista completa."""
        params = params or {}
        results = []
        page = 1
        while True:
            params['page'] = page
            data = self._get(endpoint, params=params)
            if isinstance(data, list):
                return data
            results.extend(data.get('results', []))
            if not data.get('next'):
                break
            page += 1
        return results

    # ── Empresas ──────────────────────────────────────────────
    def get_empresa(self, empresa_id):
        return self._get(f'empresas/{empresa_id}/')

    def get_empresas(self):
        return self._get_all_pages('empresas/')

    # ── Empleados ─────────────────────────────────────────────
    def get_empleados(self, empresa_id):
        return self._get_all_pages('empleados/', params={'empresa': empresa_id})

    def get_empleado(self, empleado_id):
        return self._get(f'empleados/{empleado_id}/')

    def create_empleado(self, data):
        return self._post('empleados/', data)

    def update_empleado(self, empleado_id, data):
        return self._patch(f'empleados/{empleado_id}/', data)

    # ── Contratos ─────────────────────────────────────────────
    def get_contratos(self, empleado_id):
        return self._get_all_pages('contratos/', params={'empleado': empleado_id})

    def get_contrato(self, contrato_id):
        return self._get(f'contratos/{contrato_id}/')

    # ── Catálogos por empresa ──────────────────────────────────
    def get_cargos(self, empresa_id):
        return self._get_all_pages('cargos/', params={'empresa': empresa_id})

    def get_costos(self, empresa_id):
        return self._get_all_pages('costos/', params={'empresa': empresa_id})

    def get_sedes(self, empresa_id):
        return self._get_all_pages('sedes/', params={'empresa': empresa_id})

    def get_centros_trabajo(self, empresa_id):
        return self._get_all_pages('centros-trabajo/', params={'empresa': empresa_id})

    # ── Catálogos globales ─────────────────────────────────────
    def get_bancos(self):
        return self._get_all_pages('bancos/')

    def get_ciudades(self, departamento=None):
        params = {}
        if departamento:
            params['departamento'] = departamento
        return self._get_all_pages('ciudades/', params=params)

    def get_entidades_seg_social(self, tipo=None):
        params = {}
        if tipo:
            params['tipo'] = tipo
        return self._get_all_pages('entidades-seg-social/', params=params)

    def get_tipos_documento(self):
        return self._get_all_pages('tipos-documento/')

    def get_tipos_nomina(self):
        return self._get_all_pages('tipos-nomina/')

    def get_tipos_cotizante(self):
        return self._get_all_pages('tipos-cotizante/')

    def get_subtipos_cotizante(self):
        return self._get_all_pages('subtipos-cotizante/')

    # ── Nóminas ───────────────────────────────────────────────
    def get_nominas(self, empresa_id, anio=None):
        params = {'empresa': empresa_id}
        if anio:
            params['anio'] = anio
        return self._get_all_pages('nominas/', params=params)

    def get_nomina(self, nomina_id):
        return self._get(f'nominas/{nomina_id}/')

    def get_comprobante_pdf_url(self, nomina_id):
        data = self._get(f'nominas/{nomina_id}/comprobantes-pdf/')
        return data.get('pdf_url')

    def get_resumen_pdf_url(self, nomina_id):
        data = self._get(f'nominas/{nomina_id}/resumen-pdf/')
        return data.get('pdf_url')

    # ── Novedades ─────────────────────────────────────────────
    def get_vacaciones(self, empleado_id=None, contrato_id=None):
        params = {}
        if empleado_id:
            params['empleado'] = empleado_id
        if contrato_id:
            params['contrato'] = contrato_id
        return self._get_all_pages('vacaciones/', params=params)

    def get_liquidaciones(self, empleado_id=None, contrato_id=None):
        params = {}
        if empleado_id:
            params['empleado'] = empleado_id
        if contrato_id:
            params['contrato'] = contrato_id
        return self._get_all_pages('liquidaciones/', params=params)
