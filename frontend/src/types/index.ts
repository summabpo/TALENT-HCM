export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  roles: string[]
  is_staff?: boolean
  is_superuser?: boolean
}

// ─── Tenant Admin ─────────────────────────────────────────────────────────────

/** Nested catalog payloads from GET /api/v1/tenants/:id/ */
export interface TenantCountryNested {
  id: number
  name: string
  iso_code: string
}

export interface TenantCityNested {
  id: number
  name: string
  code: string
  state_province: number
  country_id: number
}

export interface TenantArlNested {
  id: number
  code: string
  nit: string
  name: string
  entity_type: string
}

export interface TenantBankNested {
  id: number
  name: string
  code: string
}

/** Tipos de documento habituales (empresa) — el backend acepta string libre. */
export type TenantDocumentType = 'NIT' | 'CC' | 'CE' | (string & {})

export type TipoDocRepLegal = 'CC' | 'CE' | 'PA' | 'CD'
export type TipoCuentaEmpresa = 'Ahorros' | 'Corriente'
export type TipoPresentacionPlanillaPila = 'U' | 'S'

/** Tenant CRUD (staff) — aligned with GET/PATCH /api/v1/tenants/ */
export interface TenantAdmin {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  document_type?: TenantDocumentType | string
  document_number?: string
  legal_representative?: string
  phone?: string
  address?: string
  email?: string
  nit?: string
  certification_title?: string
  website?: string
  language?: string
  logo?: string | null
  signature?: string | null
  country?: TenantCountryNested | null
  city?: TenantCityNested | null
  arl?: TenantArlNested | null
  modules?: TenantModuleConfig
  module_count?: number
  /** NIT / identificación (detalle) */
  dv?: string | null
  tipo_persona?: 'N' | 'J' | null
  naturaleza_juridica?: '1' | '2' | '3' | '4' | '5' | null
  /** Representante legal (detalle) */
  tipo_doc_rep_legal?: TipoDocRepLegal | null
  numero_doc_rep_legal?: string | null
  pnombre_rep_legal?: string | null
  snombre_rep_legal?: string | null
  papellido_rep_legal?: string | null
  sapellido_rep_legal?: string | null
  /** Contactos por área */
  contacto_nomina?: string | null
  email_nomina?: string | null
  contacto_rrhh?: string | null
  email_rrhh?: string | null
  contacto_contabilidad?: string | null
  email_contabilidad?: string | null
  /** Certificaciones (adicional) */
  cargo_certificaciones?: string | null
  firma_certificaciones?: string | null
  /** Banco empresa */
  banco_empresa?: TenantBankNested | null
  num_cuenta_empresa?: string | null
  tipo_cuenta_empresa?: TipoCuentaEmpresa | null
  /** PILA */
  clase_aportante?: string | null
  tipo_aportante?: string | null
  empresa_exonerada?: boolean
  realizar_parafiscales?: boolean
  vst_ccf?: boolean
  vst_sena_icbf?: boolean
  ige100?: boolean
  sln_tarifa_pension?: string | number | null
  tipo_presentacion_planilla?: TipoPresentacionPlanillaPila | null
  codigo_sucursal?: string | null
  nombre_sucursal?: string | null
  /** Solo lectura — bridge Nomiweb */
  nomiweb_empresa_id?: number | null
}

/** Module flags for PATCH …/tenants/{id}/modules/ (matches Django TenantModules) */
export interface TenantModuleConfig {
  hiring: boolean
  personnel: boolean
  quality: boolean
  performance: boolean
  evaluations: boolean
  portal: boolean
  surveys: boolean
  orgchart: boolean
}

export interface TenantModules {
  hiring: boolean
  personnel: boolean
  quality: boolean
  performance: boolean
  evaluations: boolean
  portal: boolean
  surveys: boolean
  orgchart: boolean
}

export interface Tenant {
  id: string
  name: string
  slug: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  detail?: string
  [key: string]: unknown
}

// ─── Personnel ────────────────────────────────────────────────────────────────

export interface Department {
  id: string
  name: string
  parent: string | null
  manager: string | null
  is_active: boolean
  children_count: number
  tenant: string
  created_at: string
  updated_at: string
}

export interface EmployeeList {
  id: string
  global_employee_id: string | null
  full_name: string
  employee_number: string
  document_type: number
  document_type_code: string
  document_number: string
  email: string
  status: string
  is_active: boolean
  department: string | null
  department_name: string | null
  created_at: string
}

/** Catálogo global document-types — GET /catalogs/document-types/ */
export interface CatalogDocumentType {
  id: number
  name: string
  code: string
}

/** Catálogo global professions — GET /catalogs/professions/ */
export interface CatalogProfession {
  id: number
  name: string
}

/** Nested country/city in GET /personnel/employees/:id/ */
export interface CountryNested {
  id: number
  name: string
}

export interface CityNested {
  id: number
  name: string
  country_id: number
}

export interface Employee {
  id: string
  global_employee_id: string | null
  document_type: CatalogDocumentType
  document_number: string
  first_name: string
  second_name: string
  first_last_name: string
  second_last_name: string
  full_name: string
  email: string
  personal_email: string
  phone: string
  cell_phone: string
  address: string
  gender: string
  date_of_birth: string | null
  birth_city: CityNested | null
  birth_country: CountryNested | null
  residence_city: CityNested | null
  residence_country: CountryNested | null
  marital_status: string
  blood_type: string
  socioeconomic_stratum: string | null
  profession: CatalogProfession | null
  education_level: string
  weight?: string
  height?: string
  resume_format?: string
  document_expedition_date: string | null
  document_expedition_city: CityNested | null
  uniform_pants: string
  uniform_shirt: string
  uniform_shoes: string
  num_libreta_militar?: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  photo: string | null
  /** PDF de hoja de vida (URL absoluta o relativa) */
  resume_file?: string | null
  department: string | null
  direct_manager: string | null
  employee_number: string
  status: string
  is_active: boolean
  tenant: string
  created_at: string
  updated_at: string
}

/** Catálogo global de tipos de nómina (frecuencia de pago) */
export interface CatalogPayrollType {
  id: number
  nombre: string
  cod_dian: number | null
  activo: boolean
}

export interface Contract {
  id: string
  employee: string
  contract_type: number | null
  contract_type_name: string | null
  contract_template: number | null
  payroll_type?: number | null
  start_date: string
  end_date: string | null
  hiring_city: number | null
  salary: string
  salary_type: string
  salary_mode: string
  transport_allowance: boolean
  payment_method: string
  work_schedule: string
  bank: number | null
  bank_account_number: string
  bank_account_type: string
  position: number | null
  position_name: string | null
  cost_center: number | null
  sub_cost_center: number | null
  work_location: number | null
  work_center: string
  eps: number | null
  afp: number | null
  ccf: number | null
  severance_fund: number | null
  contributor_type: string
  contributor_subtype: string
  withholding_method: string
  withholding_percentage: string
  housing_deductible: number | null
  health_deductible: number | null
  medical_deductible: number | null
  dependents: number | null
  contract_status: string
  settlement_status: string
  social_security_status: string
  is_pensioner: string
  pension_risk: boolean
  legacy_contract_id?: string
  is_current: boolean
  document: string | null
  notes: string
  tenant: string
  created_at: string
  updated_at: string
}

export interface EmployeeDocument {
  id: string
  employee: string
  document_type: string
  title: string
  file: string
  expiration_date: string | null
  notes: string
  tenant: string
  created_at: string
  updated_at: string
}

// ─── Hiring ───────────────────────────────────────────────────────────────────

export interface HiringProcess {
  id: string
  position_title: string
  department: string | null
  department_name: string | null
  requested_by: string
  status: 'open' | 'in_progress' | 'filled' | 'cancelled'
  positions_count: number
  notes: string
  hired_count: number
  candidate_count: number
  tenant: string
  created_at: string
  updated_at: string
}

export interface Candidate {
  id: string
  hiring_process: string
  hiring_process_title: string
  full_name: string
  email: string
  phone: string
  resume: string | null
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  notes: string
  employee_id: string | null
  tenant: string
  created_at: string
  updated_at: string
}

export interface OnboardingTask {
  id: string
  checklist: string
  title: string
  description: string
  responsible_role: string
  order: number
  days_to_complete: number
  tenant: string
  created_at: string
  updated_at: string
}

export interface OnboardingTaskCompletion {
  id: string
  task: string
  task_title: string
  task_order: number
  responsible_role: string
  days_to_complete: number
  is_complete: boolean
  completed_by: string | null
  completed_at: string | null
  notes: string
}

export interface EmployeeOnboarding {
  id: string
  employee: string
  employee_name: string
  checklist: string
  checklist_name: string
  start_date: string
  completed_at: string | null
  status: 'pending' | 'in_progress' | 'completed'
  progress_percentage: number
  completions: OnboardingTaskCompletion[]
  tenant: string
  created_at: string
  updated_at: string
}

// ─── Quality ──────────────────────────────────────────────────────────────────

export interface QualityProcess {
  id: string
  name: string
  description: string
  process_type: string
  owner: string | null
  owner_name: string | null
  is_active: boolean
  document_count?: number
  tenant: string
  created_at: string
  updated_at: string
}

export interface QualityDocument {
  id: string
  process: string
  process_name: string | null
  title: string
  document_code: string
  version: string
  status: 'draft' | 'under_review' | 'approved' | 'obsolete'
  file: string | null
  approved_by: string | null
  approved_at: string | null
  review_date: string | null
  description: string
  tenant: string
  created_at: string
  updated_at: string
}

export interface InternalAudit {
  id: string
  title: string
  audit_type: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  lead_auditor: string | null
  planned_start_date: string
  planned_end_date: string
  actual_start_date: string | null
  actual_end_date: string | null
  scope: string
  objectives: string
  findings_count?: number
  tenant: string
  created_at: string
  updated_at: string
}

export interface AuditFinding {
  id: string
  audit: string
  finding_type: 'nonconformity' | 'observation' | 'opportunity'
  severity: 'critical' | 'major' | 'minor'
  description: string
  evidence: string
  requires_action: boolean
  tenant: string
  created_at: string
  updated_at: string
}

export interface NonConformity {
  id: string
  title: string
  description: string
  source: string
  severity: 'critical' | 'major' | 'minor'
  status: 'open' | 'investigating' | 'action_plan' | 'verification' | 'closed'
  owner: string | null
  owner_name: string | null
  detected_date: string
  root_cause: string
  immediate_action: string
  corrective_action: string
  preventive_action: string
  due_date: string | null
  closed_at: string | null
  tenant: string
  created_at: string
  updated_at: string
}

export interface QualityDashboard {
  total_processes: number
  active_processes: number
  total_documents: number
  documents_by_status: Record<string, number>
  open_nonconformities: number
  nonconformities_by_status: Record<string, number>
  nonconformities_by_severity: Record<string, number>
  recent_audits: InternalAudit[]
  upcoming_audits: InternalAudit[]
}

// ─── Performance ──────────────────────────────────────────────────────────────

export interface OKRPeriod {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  tenant: string
  created_at: string
  updated_at: string
}

export interface KeyResult {
  id: string
  objective: string
  title: string
  metric_type: string
  start_value: string
  target_value: string
  current_value: string
  weight: string
  responsible: string | null
  progress_percentage: number
  tenant: string
  created_at: string
  updated_at: string
}

export interface Objective {
  id: string
  period: string
  period_name?: string
  title: string
  description: string
  level: 'company' | 'department' | 'individual'
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  weight: string
  owner: string | null
  department: string | null
  parent: string | null
  progress_percentage: number
  key_results: KeyResult[]
  tenant: string
  created_at: string
  updated_at: string
}

export interface KPI {
  id: string
  name: string
  description: string
  metric_type: string
  target_value: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  is_active: boolean
  owner: string | null
  department: string | null
  quality_process: string | null
  latest_value?: string | null
  latest_date?: string | null
  tenant: string
  created_at: string
  updated_at: string
}

export interface KPIMeasurement {
  id: string
  kpi: string
  period_label: string
  period_date: string
  value: string
  recorded_by: string
  notes: string
  tenant: string
  created_at: string
  updated_at: string
}

export interface PerformanceDashboard {
  active_period: OKRPeriod | null
  objectives_by_status: Record<string, number>
  objectives_by_level: Record<string, number>
  avg_progress_by_level: Record<string, number>
  active_kpis_count: number
  kpis_on_target: number
}

// ─── Global Catalogs (admin-managed) ─────────────────────────────────────────

export interface AdminCountry {
  id: number
  name: string
  iso_code: string
  is_active: boolean
}

export interface AdminStateProvince {
  id: number
  name: string
  code: string
  country: number
  is_active: boolean
}

export interface AdminCity {
  id: number
  name: string
  code: string
  state_province: number
  /** Nombre del departamento/estado (viene del API). */
  state_province_name?: string
  is_active: boolean
}

export interface AdminDocumentType {
  id: number
  name: string
  code: string
  dian_code: number | null
  is_active: boolean
}

export interface AdminBank {
  id: number
  name: string
  code: string
  ach_code: string
  nit: string
  is_active: boolean
}

export interface AdminSocialSecurityEntity {
  id: number
  code: string
  nit: string
  name: string
  entity_type: string
  sgp_code: string
  is_active: boolean
}

// ─── Tenant-scoped Catalogs ───────────────────────────────────────────────────

export interface OrganizationalLevel {
  id: string
  name: string
  tenant: string
  created_at: string
  updated_at: string
}

export interface CatalogPosition {
  id: string
  name: string
  level: string
  is_active: boolean
  tenant: string
  created_at: string
  updated_at: string
}

export interface CostCenter {
  id: string
  name: string
  accounting_group: string
  suffix: string
  is_active: boolean
  tenant: string
  created_at: string
  updated_at: string
}

export interface SubCostCenter {
  id: string
  name: string
  cost_center: string
  suffix: string
  is_active: boolean
  tenant: string
  created_at: string
  updated_at: string
}

export interface WorkLocation {
  id: string
  name: string
  compensation_fund: number | null
  is_active: boolean
  tenant: string
  created_at: string
  updated_at: string
}

export interface WorkCenter {
  id: string
  name: string
  arl_rate: string
  economic_activity: string
  operator_code: string
  is_active: boolean
  tenant: string
  created_at: string
  updated_at: string
}
