import logging
from apps.catalogs.models import (
    City, Bank, DocumentType, SocialSecurityEntity,
    Position, CostCenter, WorkLocation, WorkCenter,
    ContributorType, ContributorSubtype, ContractType,
)

logger = logging.getLogger('integrations.mapper')


class NomiwebMapper:
    """
    Transforma datos del formato Nomiweb al formato HCM.
    La API de Nomiweb devuelve campos planos (no dicts anidados).
    Todos los métodos retornan un dict — nunca lanzan excepciones.

    Campos reales confirmados por inspección directa de la API:
    - Empleados: tipodocident_codigo, ciudadnacimiento_cod, ciudadresidencia_cod
    - Contratos: eps_codigo, afp_codigo, ccf_codigo, cesantias_codigo,
                 cargo (int), centrotrabajo (int), tipocotizante, tipocontrato_nombre
    - Costos: nomcosto (no nombrecosto)
    - CentrosTrabajo: centrotrabajo (PK int), nombrecentrotrabajo, tarifaarl
    """

    # ── Lookups de catálogos globales ─────────────────────────

    def get_city_by_code(self, codciudad):
        if not codciudad:
            return None
        try:
            return City.objects.get(code=str(codciudad))
        except City.DoesNotExist:
            logger.warning(f'Ciudad no encontrada: code={codciudad}')
            return None
        except City.MultipleObjectsReturned:
            return City.objects.filter(code=str(codciudad)).first()

    def get_bank_by_code(self, codbanco):
        if not codbanco:
            return None
        try:
            return Bank.objects.get(code=str(codbanco))
        except Bank.DoesNotExist:
            logger.warning(f'Banco no encontrado: code={codbanco}')
            return None

    def get_document_type_by_code(self, codigo):
        if not codigo:
            return None
        try:
            return DocumentType.objects.get(code=str(codigo))
        except DocumentType.DoesNotExist:
            logger.warning(f'TipoDoc no encontrado: code={codigo}')
            return None

    def get_seg_social_by_code(self, codigo):
        if not codigo:
            return None
        try:
            return SocialSecurityEntity.objects.get(code=str(codigo))
        except SocialSecurityEntity.DoesNotExist:
            logger.warning(f'EntidadSS no encontrada: code={codigo}')
            return None
        except SocialSecurityEntity.MultipleObjectsReturned:
            return SocialSecurityEntity.objects.filter(code=str(codigo)).first()

    def get_contract_type_by_name(self, nombre):
        """Lookup ContractType por nombre similar al de Nomiweb."""
        if not nombre:
            return None
        nombre_lower = nombre.lower()
        # Try exact name match first (case-insensitive)
        qs = ContractType.objects.filter(name__iexact=nombre)
        if qs.exists():
            return qs.first()
        # Keyword matching for common variations
        if 'indefinido' in nombre_lower:
            return ContractType.objects.filter(dian_code=1).first()
        if 'fijo' in nombre_lower:
            return ContractType.objects.filter(dian_code=2).first()
        if 'obra' in nombre_lower or 'labor' in nombre_lower:
            return ContractType.objects.filter(dian_code=4).first()
        if 'aprendizaje' in nombre_lower:
            return ContractType.objects.filter(dian_code=5).first()
        if 'servicio' in nombre_lower or 'prestacion' in nombre_lower or 'prestación' in nombre_lower:
            return ContractType.objects.filter(name__icontains='servicio').first()
        # Fallback: partial name search
        qs = ContractType.objects.filter(name__icontains=nombre[:10])
        return qs.first()

    def get_position_by_nomiweb_id(self, tenant, idcargo):
        if not idcargo:
            return None
        try:
            return Position.objects.get(tenant=tenant, nomiweb_cargo_id=int(idcargo))
        except Position.DoesNotExist:
            logger.warning(f'Position no encontrada: nomiweb_cargo_id={idcargo}')
            return None

    def get_cost_center_by_nomiweb_id(self, tenant, idcosto):
        if not idcosto:
            return None
        try:
            return CostCenter.objects.get(tenant=tenant, nomiweb_costo_id=int(idcosto))
        except CostCenter.DoesNotExist:
            return None

    def get_work_location_by_nomiweb_id(self, tenant, idsede):
        if not idsede:
            return None
        try:
            return WorkLocation.objects.get(tenant=tenant, nomiweb_sede_id=int(idsede))
        except WorkLocation.DoesNotExist:
            return None

    def get_work_center_by_nomiweb_id(self, tenant, idcentro):
        if not idcentro:
            return None
        try:
            return WorkCenter.objects.get(tenant=tenant, nomiweb_ct_id=int(idcentro))
        except WorkCenter.DoesNotExist:
            return None

    def get_contributor_type_by_code(self, codigo):
        if not codigo:
            return None
        try:
            return ContributorType.objects.get(code=str(codigo))
        except ContributorType.DoesNotExist:
            logger.warning(f'ContributorType no encontrado: code={codigo}')
            return None

    # ── Mapeo de Empresa → Tenant ─────────────────────────────

    def empresa_to_tenant(self, empresa_data, tenant=None):
        """
        Transforma datos de Empresa Nomiweb al formato de Tenant HCM.
        Campos reales confirmados: nombreempresa, idciudad FK como dict,
        telefono, email, direccion, nit, dv.
        """
        ciudad = None
        ciudad_data = empresa_data.get('idciudad')
        if ciudad_data and isinstance(ciudad_data, dict):
            ciudad = self.get_city_by_code(ciudad_data.get('codciudad'))

        data = {
            'name': empresa_data.get('nombreempresa', ''),
            'nomiweb_empresa_id': empresa_data.get('idempresa'),
        }

        if empresa_data.get('nit'):
            data['nit'] = str(empresa_data['nit'])
        if empresa_data.get('dv'):
            data['dv'] = str(empresa_data['dv'])
        if empresa_data.get('telefono'):
            data['phone'] = str(empresa_data['telefono'])
        if empresa_data.get('email'):
            data['email'] = empresa_data['email']
        if empresa_data.get('direccion'):
            data['address'] = empresa_data['direccion']
        if ciudad:
            data['city'] = ciudad

        return data

    # ── Mapeo de Contratosemp → Employee ──────────────────────

    def contratosemp_to_employee(self, emp_data, tenant):
        """
        Transforma datos de Contratosemp Nomiweb al formato Employee HCM.

        Campos reales Nomiweb (planos, no dicts):
          tipodocident_codigo: "CC"
          ciudadnacimiento_cod: "11"
          ciudadresidencia_cod: "11"
          docidentidad: 52644372  (int — Employee.document_number es BigIntegerField)
        """
        doc_type = self.get_document_type_by_code(
            emp_data.get('tipodocident_codigo')
        )

        ciudad_nac = self.get_city_by_code(emp_data.get('ciudadnacimiento_cod'))
        ciudad_res = self.get_city_by_code(emp_data.get('ciudadresidencia_cod'))

        raw_doc = emp_data.get('docidentidad', '')
        try:
            doc_number = int(raw_doc) if raw_doc else None
        except (ValueError, TypeError):
            doc_number = None

        data = {
            'tenant': tenant,
            'first_name': emp_data.get('pnombre', ''),
            'second_name': emp_data.get('snombre', '') or '',
            'first_last_name': emp_data.get('papellido', ''),
            'second_last_name': emp_data.get('sapellido', '') or '',
            'nomiweb_empleado_id': emp_data.get('idempleado'),
        }

        if doc_number is not None:
            data['document_number'] = doc_number
        if doc_type:
            data['document_type'] = doc_type
        if ciudad_nac:
            data['birth_city'] = ciudad_nac
        if ciudad_res:
            data['residence_city'] = ciudad_res

        # Optional flat fields
        optional_fields = {
            'telefonoempleado': 'phone',
            'celular': 'cell_phone',
            'email': 'email',
            'direccionempleado': 'address',
            'estadocivil': 'marital_status',
            'niveleducativo': 'education_level',
            'estrato': 'socioeconomic_stratum',
            'gruposanguineo': 'blood_type',
            'sexo': 'gender',
            'peso': 'weight',
            'estatura': 'height',
            'fechanac': 'date_of_birth',
        }
        for nomiweb_field, hcm_field in optional_fields.items():
            val = emp_data.get(nomiweb_field)
            if val is not None and val not in ('', 'no data'):
                data[hcm_field] = val

        return data

    # ── Mapeo de Contratos → Contract ────────────────────────

    def contratos_to_contract(self, contrato_data, employee, tenant):
        """
        Transforma datos de Contratos Nomiweb al formato Contract HCM.

        Campos reales Nomiweb (planos):
          cargo: int (nomiweb_cargo_id)
          centrotrabajo: int (nomiweb_ct_id)
          eps_codigo: "EPS037"
          afp_codigo: "230201"
          ccf_codigo: "CCF22"
          cesantias_codigo: null / string
          tipocotizante: "01"
          tipocontrato_nombre: "Termino Indefinido"
          banco_cod: null / string
          idcosto: int, idsede: int
        """
        eps = self.get_seg_social_by_code(contrato_data.get('eps_codigo'))
        afp = self.get_seg_social_by_code(contrato_data.get('afp_codigo'))
        ccf = self.get_seg_social_by_code(contrato_data.get('ccf_codigo'))
        severance = self.get_seg_social_by_code(contrato_data.get('cesantias_codigo'))
        banco = self.get_bank_by_code(contrato_data.get('banco_cod'))

        # Position: campo 'cargo' en contratos = nomiweb_cargo_id
        position = self.get_position_by_nomiweb_id(
            tenant, contrato_data.get('cargo')
        )

        # WorkCenter: campo 'centrotrabajo' (int PK in Nomiweb)
        work_center = self.get_work_center_by_nomiweb_id(
            tenant, contrato_data.get('centrotrabajo')
        )

        cost_center = self.get_cost_center_by_nomiweb_id(
            tenant, contrato_data.get('idcosto')
        )
        work_location = self.get_work_location_by_nomiweb_id(
            tenant, contrato_data.get('idsede')
        )

        contributor_type = self.get_contributor_type_by_code(
            contrato_data.get('tipocotizante') or contrato_data.get('tipocotizante_cod')
        )

        contract_type = self.get_contract_type_by_name(
            contrato_data.get('tipocontrato_nombre', '')
        )

        data = {
            'employee': employee,
            'tenant': tenant,
            'salary': contrato_data.get('salario', 0) or 0,
            'nomiweb_contrato_id': contrato_data.get('idcontrato'),
        }

        if eps:
            data['eps'] = eps
        if afp:
            data['afp'] = afp
        if ccf:
            data['ccf'] = ccf
        if severance:
            data['severance_fund'] = severance
        if banco:
            data['bank'] = banco
        if position:
            data['position'] = position
        if work_center:
            data['work_center'] = work_center
        if cost_center:
            data['cost_center'] = cost_center
        if work_location:
            data['work_location'] = work_location
        if contributor_type:
            data['contributor_type'] = contributor_type
        if contract_type:
            data['contract_type'] = contract_type

        if contrato_data.get('fechainiciocontrato'):
            data['start_date'] = contrato_data['fechainiciocontrato']
        elif contrato_data.get('fechainicio'):
            data['start_date'] = contrato_data['fechainicio']

        if contrato_data.get('fechafincontrato'):
            data['end_date'] = contrato_data['fechafincontrato']

        # Optional flat fields
        optional_fields = {
            'cuentanomina': 'bank_account_number',
            'tipocuentanomina': 'bank_account_type',
            'jornada': 'work_schedule',
        }
        for nomiweb_field, hcm_field in optional_fields.items():
            val = contrato_data.get(nomiweb_field)
            if val is not None and val != '':
                data[hcm_field] = val

        return data

    # ── Mapeo de catálogos por empresa ────────────────────────

    def cargo_to_position(self, cargo_data, tenant):
        return {
            'tenant': tenant,
            'name': cargo_data.get('nombrecargo') or cargo_data.get('nombre', ''),
            'nomiweb_cargo_id': cargo_data.get('idcargo'),
        }

    def costo_to_cost_center(self, costo_data, tenant):
        # Nomiweb usa 'nomcosto', no 'nombrecosto'
        return {
            'tenant': tenant,
            'name': (costo_data.get('nomcosto')
                     or costo_data.get('nombrecosto')
                     or costo_data.get('nombre', '')),
            'nomiweb_costo_id': costo_data.get('idcosto'),
        }

    def sede_to_work_location(self, sede_data, tenant):
        return {
            'tenant': tenant,
            'name': sede_data.get('nombresede') or sede_data.get('nombre', ''),
            'nomiweb_sede_id': sede_data.get('idsede'),
        }

    def centrotrabajo_to_work_center(self, ct_data, tenant):
        # PK en Nomiweb es 'centrotrabajo' (int), nombre es 'nombrecentrotrabajo'
        return {
            'tenant': tenant,
            'name': ct_data.get('nombrecentrotrabajo') or ct_data.get('nombre', ''),
            'nomiweb_ct_id': ct_data.get('centrotrabajo'),
            'arl_rate': ct_data.get('tarifaarl') or 0,
        }
