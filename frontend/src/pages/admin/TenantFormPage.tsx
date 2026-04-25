import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { catalogsApi } from '@/api/catalogs'
import { tenantsApi } from '@/api/tenants'
import { useAuth } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { Card, CardHeader } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import SelectSearchable, { type SearchableOption } from '@/components/ui/SelectSearchable'
import type { TenantModuleConfig } from '@/types'

const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

function slugifyText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const DOC_TYPES = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
] as const

const REP_LEGAL_DOC_TYPES = [
  { value: 'CC', label: 'CC' },
  { value: 'CE', label: 'CE' },
  { value: 'PA', label: 'PA' },
  { value: 'CD', label: 'CD' },
] as const

const ACCOUNT_TYPES = [
  { value: 'Ahorros', label: 'Ahorros' },
  { value: 'Corriente', label: 'Corriente' },
] as const

const TIPO_PLANILLA = [
  { value: 'U', label: 'Única' },
  { value: 'S', label: 'Sucursal' },
] as const

type FormValues = {
  name: string
  slug: string
  is_active: boolean
  document_type: string
  document_number: string
  legal_representative: string
  phone: string
  arl_id: string
  country_id: string
  city_id: string
  address: string
  email: string
  nit: string
  certification_title: string
  website: string
  language: string
  tipo_doc_rep_legal: string
  numero_doc_rep_legal: string
  pnombre_rep_legal: string
  snombre_rep_legal: string
  papellido_rep_legal: string
  sapellido_rep_legal: string
  contacto_nomina: string
  email_nomina: string
  contacto_rrhh: string
  email_rrhh: string
  contacto_contabilidad: string
  email_contabilidad: string
  banco_empresa_id: string
  num_cuenta_empresa: string
  tipo_cuenta_empresa: string
  clase_aportante: string
  tipo_aportante: string
  empresa_exonerada: boolean
  realizar_parafiscales: boolean
  vst_ccf: boolean
  vst_sena_icbf: boolean
  ige100: boolean
  sln_tarifa_pension: string
  tipo_presentacion_planilla: string
  codigo_sucursal: string
  nombre_sucursal: string
}

const DEFAULT_MODULES: TenantModuleConfig = {
  hiring: true,
  personnel: true,
  quality: true,
  performance: true,
  evaluations: false,
  portal: false,
  surveys: false,
  orgchart: false,
}

const MODULE_DEFS: {
  key: keyof TenantModuleConfig
  label: string
  description: string
}[] = [
  { key: 'hiring', label: 'Contratación', description: 'Procesos de selección, candidatos y contratación.' },
  { key: 'personnel', label: 'Personal', description: 'Empleados, contratos, documentos y onboarding.' },
  { key: 'quality', label: 'Calidad', description: 'ISO 9001: procesos, auditorías y no conformidades.' },
  { key: 'performance', label: 'Desempeño', description: 'KPIs, OKRs y seguimiento de objetivos.' },
  { key: 'evaluations', label: 'Evaluaciones', description: 'Evaluaciones de desempeño y desarrollo.' },
  { key: 'portal', label: 'Portal', description: 'Portal del empleado y autoservicio.' },
  { key: 'surveys', label: 'Encuestas', description: 'Clima laboral y pulso organizacional.' },
  { key: 'orgchart', label: 'Organigrama', description: 'Estructura y jerarquías.' },
]

function buildFormData(body: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [key, v] of Object.entries(body)) {
    if (v === undefined) continue
    if (v === null) continue
    if (typeof v === 'boolean') {
      fd.append(key, v ? 'true' : 'false')
      continue
    }
    fd.append(key, String(v))
  }
  return fd
}

function validateImageFile(f: File | undefined): string | null {
  if (!f) return null
  if (f.size > IMAGE_MAX_BYTES) {
    return 'El archivo no puede superar 2 MB. Elige otra imagen (JPG, PNG o WebP).'
  }
  if (!/image\/(jpeg|png|webp)/i.test(f.type)) {
    return 'Solo se permiten imágenes JPG, PNG o WebP.'
  }
  return null
}

export default function TenantFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, tenant: sessionTenant } = useAuth()
  const isPlatformSuper = user?.is_superuser === true
  const logoInput = useRef<HTMLInputElement>(null)
  const signatureInput = useRef<HTMLInputElement>(null)
  const [slugManual, setSlugManual] = useState(false)
  const [modules, setModules] = useState<TenantModuleConfig>(DEFAULT_MODULES)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantsApi.get(id!),
    enabled: isEdit,
  })

  const {
    data: countries = [],
    isLoading: countriesLoading,
    isError: countriesError,
  } = useQuery({
    queryKey: ['catalog', 'countries'],
    queryFn: () => tenantsApi.getCountries(),
  })

  const {
    data: arls = [],
    isLoading: arlsLoading,
    isError: arlsError,
  } = useQuery({
    queryKey: ['catalog', 'arls'],
    queryFn: () => tenantsApi.getARLs(),
  })

  const {
    data: banks = [],
    isLoading: banksLoading,
    isError: banksError,
  } = useQuery({
    queryKey: ['catalog', 'banks'],
    queryFn: () => catalogsApi.banks(),
  })

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      is_active: true,
      name: '',
      slug: '',
      document_type: 'NIT',
      document_number: '',
      legal_representative: '',
      phone: '',
      arl_id: '',
      country_id: '',
      city_id: '',
      address: '',
      email: '',
      nit: '',
      certification_title: '',
      website: '',
      language: 'es',
      tipo_doc_rep_legal: '',
      numero_doc_rep_legal: '',
      pnombre_rep_legal: '',
      snombre_rep_legal: '',
      papellido_rep_legal: '',
      sapellido_rep_legal: '',
      contacto_nomina: '',
      email_nomina: '',
      contacto_rrhh: '',
      email_rrhh: '',
      contacto_contabilidad: '',
      email_contabilidad: '',
      banco_empresa_id: '',
      num_cuenta_empresa: '',
      tipo_cuenta_empresa: '',
      clase_aportante: '',
      tipo_aportante: '',
      empresa_exonerada: false,
      realizar_parafiscales: true,
      vst_ccf: true,
      vst_sena_icbf: true,
      ige100: false,
      sln_tarifa_pension: '',
      tipo_presentacion_planilla: '',
      codigo_sucursal: '',
      nombre_sucursal: '',
    },
  })

  const slugReg = register('slug', {
    required: 'Requerido',
    pattern: {
      value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message: 'Solo minúsculas, números y guiones',
    },
  })

  const countryId = useWatch({ control, name: 'country_id' })
  const documentType = useWatch({ control, name: 'document_type' })
  const nameVal = useWatch({ control, name: 'name' })

  const countryIdNum = countryId ? Number(countryId) : 0

  /**
   * Una sola carga por país (page_size vía API + paginación DRF corregida).
   * Búsqueda al escribir solo en cliente: si recargáramos vía ?search= y
   * deshabilitáramos el Select durante isLoading, al 2.º carácter se pierde
   * el foco y no deja teclear.
   */
  const {
    data: cities = [],
    isPending: citiesPending,
    isError: citiesError,
  } = useQuery({
    queryKey: ['catalog', 'cities', countryIdNum],
    queryFn: () => (countryIdNum ? tenantsApi.getCities(countryIdNum) : []),
    enabled: countryIdNum > 0,
  })
  const citiesInitialLoad = countryIdNum > 0 && citiesPending

  const countryOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = countries.map((c) => ({ value: String(c.id), label: c.name }))
    if (tenant?.country) {
      const id = String(tenant.country.id)
      if (!fromApi.some((o) => o.value === id)) {
        return [{ value: id, label: tenant.country.name }, ...fromApi]
      }
    }
    return fromApi
  }, [countries, tenant])
  const cityOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = cities.map((c) => ({ value: String(c.id), label: c.name }))
    if (tenant?.city && Number(tenant.city.country_id) === countryIdNum) {
      const id = String(tenant.city.id)
      if (!fromApi.some((o) => o.value === id)) {
        return [{ value: id, label: tenant.city.name }, ...fromApi]
      }
    }
    return fromApi
  }, [cities, tenant, countryIdNum])
  const arlOptions = useMemo<SearchableOption[]>(
    () => arls.map((a) => ({ value: String(a.id), label: a.name })),
    [arls],
  )
  const bankOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = banks.map((b) => ({ value: String(b.id), label: b.name }))
    if (tenant?.banco_empresa) {
      const bid = String(tenant.banco_empresa.id)
      if (!fromApi.some((o) => o.value === bid)) {
        return [{ value: bid, label: tenant.banco_empresa.name }, ...fromApi]
      }
    }
    return fromApi
  }, [banks, tenant])

  useEffect(() => {
    if (!tenant) return
    const dt = (tenant.document_type || '').toUpperCase()
    const docType = ['NIT', 'CC', 'CE'].includes(dt) ? dt : 'NIT'
    const tdoc = (tenant.tipo_doc_rep_legal || '').toUpperCase()
    const repDoc = ['CC', 'CE', 'PA', 'CD'].includes(tdoc) ? tdoc : ''
    const tcuenta = tenant.tipo_cuenta_empresa ?? ''
    const cuentaOk = tcuenta === 'Ahorros' || tcuenta === 'Corriente' ? tcuenta : ''
    const tplan = tenant.tipo_presentacion_planilla ?? ''
    const planOk = tplan === 'U' || tplan === 'S' ? tplan : ''
    const pen = tenant.sln_tarifa_pension
    reset({
      name: tenant.name,
      slug: tenant.slug,
      is_active: tenant.is_active,
      document_type: docType,
      document_number: tenant.document_number ?? '',
      legal_representative: tenant.legal_representative ?? '',
      phone: tenant.phone ?? '',
      arl_id: tenant.arl ? String(tenant.arl.id) : '',
      country_id: tenant.country ? String(tenant.country.id) : '',
      city_id: tenant.city ? String(tenant.city.id) : '',
      address: tenant.address ?? '',
      email: tenant.email ?? '',
      nit: tenant.nit ?? '',
      certification_title: tenant.certification_title ?? '',
      website: tenant.website ?? '',
      language: tenant.language ?? 'es',
      tipo_doc_rep_legal: repDoc,
      numero_doc_rep_legal: tenant.numero_doc_rep_legal ?? '',
      pnombre_rep_legal: tenant.pnombre_rep_legal ?? '',
      snombre_rep_legal: tenant.snombre_rep_legal ?? '',
      papellido_rep_legal: tenant.papellido_rep_legal ?? '',
      sapellido_rep_legal: tenant.sapellido_rep_legal ?? '',
      contacto_nomina: tenant.contacto_nomina ?? '',
      email_nomina: tenant.email_nomina ?? '',
      contacto_rrhh: tenant.contacto_rrhh ?? '',
      email_rrhh: tenant.email_rrhh ?? '',
      contacto_contabilidad: tenant.contacto_contabilidad ?? '',
      email_contabilidad: tenant.email_contabilidad ?? '',
      banco_empresa_id: tenant.banco_empresa ? String(tenant.banco_empresa.id) : '',
      num_cuenta_empresa: tenant.num_cuenta_empresa ?? '',
      tipo_cuenta_empresa: cuentaOk,
      clase_aportante: tenant.clase_aportante ?? '',
      tipo_aportante: tenant.tipo_aportante ?? '',
      empresa_exonerada: tenant.empresa_exonerada ?? false,
      realizar_parafiscales: tenant.realizar_parafiscales !== false,
      vst_ccf: tenant.vst_ccf !== false,
      vst_sena_icbf: tenant.vst_sena_icbf !== false,
      ige100: tenant.ige100 === true,
      sln_tarifa_pension: pen != null && pen !== '' ? String(pen) : '',
      tipo_presentacion_planilla: planOk,
      codigo_sucursal: tenant.codigo_sucursal ?? '',
      nombre_sucursal: tenant.nombre_sucursal ?? '',
    })
    if (tenant.modules) setModules({ ...DEFAULT_MODULES, ...tenant.modules })
    setSlugManual(true)
    setLogoPreview(tenant.logo ?? null)
    setSignaturePreview(tenant.signature ?? null)
  }, [tenant, reset])

  useEffect(() => {
    if (!isEdit && !slugManual && nameVal) {
      setValue('slug', slugifyText(nameVal))
    }
  }, [nameVal, isEdit, slugManual, setValue])

  useEffect(() => {
    if (!showSaveSuccess) return
    const t = window.setTimeout(() => {
      setShowSaveSuccess(false)
      navigate('/admin/tenants')
    }, 1600)
    return () => window.clearTimeout(t)
  }, [showSaveSuccess, navigate])

  const buildPayload = useCallback(
    (values: FormValues): Record<string, unknown> => {
      const slug = values.slug.trim().toLowerCase()
      const penRaw = values.sln_tarifa_pension.trim().replace(',', '.')
      const penNum = penRaw ? Number(penRaw) : NaN
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        slug,
        is_active: values.is_active,
        document_type: values.document_type.trim(),
        document_number: values.document_number.trim(),
        legal_representative: values.legal_representative.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        email: values.email.trim(),
        nit: values.nit.trim(),
        certification_title: values.certification_title.trim(),
        website: values.website.trim(),
        language: values.language,
        tipo_doc_rep_legal: values.tipo_doc_rep_legal.trim() || null,
        numero_doc_rep_legal: values.numero_doc_rep_legal.trim() || null,
        pnombre_rep_legal: values.pnombre_rep_legal.trim() || null,
        snombre_rep_legal: values.snombre_rep_legal.trim() || null,
        papellido_rep_legal: values.papellido_rep_legal.trim() || null,
        sapellido_rep_legal: values.sapellido_rep_legal.trim() || null,
        contacto_nomina: values.contacto_nomina.trim() || null,
        email_nomina: values.email_nomina.trim() || null,
        contacto_rrhh: values.contacto_rrhh.trim() || null,
        email_rrhh: values.email_rrhh.trim() || null,
        contacto_contabilidad: values.contacto_contabilidad.trim() || null,
        email_contabilidad: values.email_contabilidad.trim() || null,
        num_cuenta_empresa: values.num_cuenta_empresa.trim() || null,
        tipo_cuenta_empresa: values.tipo_cuenta_empresa.trim() || null,
        clase_aportante: values.clase_aportante.trim() || null,
        tipo_aportante: values.tipo_aportante.trim() || null,
        empresa_exonerada: values.empresa_exonerada,
        realizar_parafiscales: values.realizar_parafiscales,
        vst_ccf: values.vst_ccf,
        vst_sena_icbf: values.vst_sena_icbf,
        ige100: values.ige100,
        sln_tarifa_pension: penRaw && !Number.isNaN(penNum) ? penNum : null,
        tipo_presentacion_planilla: values.tipo_presentacion_planilla.trim() || null,
        codigo_sucursal: values.codigo_sucursal.trim() || null,
        nombre_sucursal: values.nombre_sucursal.trim() || null,
      }
      body.arl = values.arl_id ? Number(values.arl_id) : null
      body.country = values.country_id ? Number(values.country_id) : null
      body.city = values.city_id ? Number(values.city_id) : null
      body.banco_empresa = values.banco_empresa_id ? Number(values.banco_empresa_id) : null
      return body
    },
    [],
  )

  const clearFileMutation = useMutation({
    mutationFn: (clear: { clear_logo?: boolean; clear_signature?: boolean }) =>
      tenantsApi.update(id!, clear),
    onSuccess: (_, clear) => {
      qc.invalidateQueries({ queryKey: ['tenant', id] })
      qc.invalidateQueries({ queryKey: ['tenants'] })
      if (clear.clear_logo) {
        setLogoPreview(null)
        if (logoInput.current) logoInput.current.value = ''
      }
      if (clear.clear_signature) {
        setSignaturePreview(null)
        if (signatureInput.current) signatureInput.current.value = ''
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      values: FormValues
      logoFile: File | null
      signatureFile: File | null
    }) => {
      const { values, logoFile, signatureFile } = payload
      const hasFiles = Boolean(logoFile || signatureFile)
      const body = buildPayload(values)
      setFileError(null)

      let savedId: string

      if (hasFiles) {
        const fd = buildFormData(body)
        if (logoFile) fd.append('logo', logoFile)
        if (signatureFile) fd.append('signature', signatureFile)
        if (isEdit) {
          const t = await tenantsApi.updateForm(id!, fd)
          savedId = t.id
        } else {
          const t = await tenantsApi.createForm(fd)
          savedId = t.id
        }
      } else if (isEdit) {
        const t = await tenantsApi.update(id!, body)
        savedId = t.id
      } else {
        const t = await tenantsApi.create(body)
        savedId = t.id
      }

      if (isPlatformSuper) {
        await tenantsApi.updateModules(savedId, modules)
      }
      return savedId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      qc.invalidateQueries({ queryKey: ['tenant', id] })
      setShowSaveSuccess(true)
    },
  })

  const saving = isSubmitting || saveMutation.isPending
  const apiError = saveMutation.error as Error & { response?: { data?: unknown } } | null

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const f = e.target.files?.[0]
    if (f) {
      const err = validateImageFile(f)
      if (err) {
        setFileError(err)
        e.target.value = ''
        return
      }
      if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
      setLogoPreview(URL.createObjectURL(f))
    }
  }

  function onSignatureChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const f = e.target.files?.[0]
    if (f) {
      const err = validateImageFile(f)
      if (err) {
        setFileError(err)
        e.target.value = ''
        return
      }
      if (signaturePreview && signaturePreview.startsWith('blob:')) URL.revokeObjectURL(signaturePreview)
      setSignaturePreview(URL.createObjectURL(f))
    }
  }

  function onSubmit(values: FormValues) {
    const logoFile = logoInput.current?.files?.[0] ?? null
    const signatureFile = signatureInput.current?.files?.[0] ?? null
    if (logoFile) {
      const e = validateImageFile(logoFile)
      if (e) {
        setFileError(e)
        return
      }
    }
    if (signatureFile) {
      const e2 = validateImageFile(signatureFile)
      if (e2) {
        setFileError(e2)
        return
      }
    }
    saveMutation.mutate({ values, logoFile, signatureFile })
  }

  function toggleModule(key: keyof TenantModuleConfig) {
    setModules((m) => ({ ...m, [key]: !m[key] }))
  }

  if (!user?.is_staff) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-lg font-bold text-summa-ink">Acceso restringido</h2>
        <p className="text-sm text-summa-ink-light">Solo el personal staff puede administrar empresas (tenants).</p>
      </div>
    )
  }

  if (!isEdit && !isPlatformSuper) {
    if (sessionTenant?.id) {
      return <Navigate to={`/admin/tenants/${sessionTenant.id}/edit`} replace />
    }
    return <Navigate to="/admin/tenants" replace />
  }

  if (isEdit && tenantLoading) return <LoadingSpinner />

  const breadcrumbs = isEdit
    ? [
        { label: 'Admin', to: '/admin' },
        { label: 'Empresas', to: '/admin/tenants' },
        { label: tenant?.name ?? '…' },
      ]
    : [
        { label: 'Admin', to: '/admin' },
        { label: 'Empresas', to: '/admin/tenants' },
        { label: 'Nueva empresa' },
      ]

  return (
    <div className="animate-fade-in max-w-4xl pb-10">
      <Breadcrumb items={breadcrumbs} />

      <div className="page-header">
        <h1 className="page-title" style={{ color: '#212f87' }}>{isEdit ? 'Editar empresa' : 'Nueva empresa'}</h1>
        <p className="text-sm text-summa-ink-light mt-1">
          Registro del cliente, contacto, seguridad social, módulos (superadmin) y archivos de marca.
        </p>
      </div>

      {showSaveSuccess && (
        <div
          className="mb-4 rounded-summa border p-4 text-sm font-semibold"
          style={{ borderColor: '#7dc7e9', background: 'rgba(125, 199, 233, 0.15)', color: '#212f87' }}
        >
          Empresa guardada correctamente. Redirigiendo al listado…
        </div>
      )}

      {fileError && <ErrorAlert message={fileError} className="mb-4" onRetry={() => setFileError(null)} />}

      {apiError && (
        <ErrorAlert
          message="No se pudo guardar. Revisá los datos o intentá de nuevo."
          error={apiError}
          className="mb-4"
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader title="1. Información básica" subtitle="Identificación y datos legales de la empresa" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Nombre de la empresa <span style={{ color: '#d52680' }}>*</span>
              </label>
              <input {...register('name', { required: 'Requerido' })} className="input" placeholder="Mi Empresa SAS" />
              {errors.name && <p className="text-sm mt-1" style={{ color: '#d52680' }}>{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Slug <span style={{ color: '#d52680' }}>*</span>
              </label>
              <input
                {...slugReg}
                onChange={(e) => {
                  setSlugManual(true)
                  slugReg.onChange(e)
                }}
                className="input font-mono"
                placeholder="mi-empresa"
              />
              {errors.slug && <p className="text-sm mt-1" style={{ color: '#d52680' }}>{errors.slug.message}</p>}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input type="checkbox" {...register('is_active')} className="rounded border-summa-border" style={{ accentColor: '#d52680' }} />
                <span className="text-sm font-semibold text-summa-ink">Empresa activa</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Tipo de documento <span style={{ color: '#d52680' }}>*</span>
              </label>
              <select {...register('document_type', { required: 'Requerido' })} className="input">
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                NIT / Número de identificación <span style={{ color: '#d52680' }}>*</span>
              </label>
              <input
                {...register('nit', { required: 'Requerido' })}
                className="input font-mono"
                placeholder={documentType === 'NIT' ? '800123456-1' : 'Número'}
              />
              {errors.nit && <p className="text-sm mt-1" style={{ color: '#d52680' }}>{errors.nit.message}</p>}
            </div>
            {documentType === 'NIT' && (
              <div>
                <label className="block text-sm font-semibold text-summa-ink mb-1">Dígito de verificación (si aplica)</label>
                <input {...register('document_number')} className="input" placeholder="DV" maxLength={2} />
              </div>
            )}
            {documentType !== 'NIT' && (
              <div>
                <label className="block text-sm font-semibold text-summa-ink mb-1">Complemento / notas de documento</label>
                <input {...register('document_number')} className="input" placeholder="Opcional" />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Representante legal <span style={{ color: '#d52680' }}>*</span>
              </label>
              <input
                {...register('legal_representative', { required: 'Requerido' })}
                className="input"
                placeholder="Nombre completo"
              />
              {errors.legal_representative && (
                <p className="text-sm mt-1" style={{ color: '#d52680' }}>{errors.legal_representative.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">Sitio web (opcional)</label>
              <input type="url" {...register('website')} className="input" placeholder="https://www.empresa.com" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="2. Contacto y ubicación" subtitle="Comunicación y sede de la compañía" />
          {countriesError && (
            <ErrorAlert message="No se pudieron cargar los países. Verificá la conexión o reintentá." className="mb-4" />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Email corporativo <span style={{ color: '#d52680' }}>*</span>
              </label>
              <input
                type="email"
                {...register('email', { required: 'Requerido' })}
                className="input"
                placeholder="contacto@empresa.com"
              />
              {errors.email && <p className="text-sm mt-1" style={{ color: '#d52680' }}>{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Teléfono <span style={{ color: '#d52680' }}>*</span>
              </label>
              <input
                {...register('phone', { required: 'Requerido' })}
                className="input"
                placeholder="+57 …"
              />
              {errors.phone && <p className="text-sm mt-1" style={{ color: '#d52680' }}>{errors.phone.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Dirección <span style={{ color: '#d52680' }}>*</span>
              </label>
              <input
                {...register('address', { required: 'Requerido' })}
                className="input"
                placeholder="Calle, número, oficina"
              />
              {errors.address && <p className="text-sm mt-1" style={{ color: '#d52680' }}>{errors.address.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1" htmlFor="tenant-country">
                País <span style={{ color: '#d52680' }}>*</span>
              </label>
              <Controller
                name="country_id"
                control={control}
                rules={{ required: 'Seleccione un país' }}
                render={({ field, fieldState }) => (
                  <div id="tenant-country">
                    <SelectSearchable
                      inputId="tenant-country"
                      options={countryOptions}
                      value={countryOptions.find((o) => o.value === field.value) ?? null}
                      onChange={(opt) => {
                        field.onChange(opt?.value ?? '')
                        setValue('city_id', '', { shouldValidate: true })
                      }}
                      isLoading={countriesLoading}
                      isDisabled={countriesLoading}
                      isClearable
                      placeholder={countriesLoading ? 'Cargando países…' : 'Escriba para filtrar o elija…'}
                      noOptionsMessage={() => 'Sin resultados. Probá otra búsqueda (al inicio o por palabra).'}
                      loadingMessage={() => 'Cargando…'}
                    />
                    {fieldState.error && (
                      <p className="text-sm mt-1" style={{ color: '#d52680' }}>{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1" htmlFor="tenant-city">
                Ciudad <span style={{ color: '#d52680' }}>*</span>
              </label>
              <Controller
                name="city_id"
                control={control}
                rules={{
                  validate: (val) => {
                    if (!countryIdNum) return true
                    if (!val) return 'Seleccione una ciudad'
                    return true
                  },
                }}
                render={({ field, fieldState }) => (
                  <div id="tenant-city">
                    <SelectSearchable
                      inputId="tenant-city"
                      options={cityOptions}
                      value={cityOptions.find((o) => o.value === field.value) ?? null}
                      onChange={(opt) => field.onChange(opt?.value ?? '')}
                      isLoading={citiesInitialLoad}
                      isDisabled={!countryIdNum || citiesInitialLoad}
                      isClearable
                      placeholder={
                        !countryIdNum
                          ? '— Primero elija país —'
                          : citiesInitialLoad
                            ? 'Cargando ciudades…'
                            : 'Escriba para filtrar o elija de la lista…'
                      }
                      noOptionsMessage={() =>
                        citiesError
                          ? 'Error al cargar'
                          : 'Sin resultados. Probá otra búsqueda o cambiá de país.'}
                      loadingMessage={() => 'Cargando…'}
                    />
                    {citiesError && countryIdNum > 0 && (
                      <p className="text-sm mt-1 text-amber-800">No se pudieron cargar las ciudades. Reintentá o cambiá de país.</p>
                    )}
                    {fieldState.error && (
                      <p className="text-sm mt-1" style={{ color: '#d52680' }}>{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="3. Seguridad social" subtitle="Entidad ARL (riesgos laborales)" />
          {arlsError && (
            <p className="text-sm text-amber-800 mb-3">No se pudieron cargar las ARL. Reintentá recargar la página.</p>
          )}
          <div className="max-w-lg">
            <label className="block text-sm font-semibold text-summa-ink mb-1" htmlFor="tenant-arl">ARL</label>
            <Controller
              name="arl_id"
              control={control}
              render={({ field }) => (
                <SelectSearchable
                  inputId="tenant-arl"
                  options={arlOptions}
                  value={field.value ? arlOptions.find((o) => o.value === field.value) ?? null : null}
                  onChange={(opt) => field.onChange(opt?.value ?? '')}
                  isLoading={arlsLoading}
                  isDisabled={arlsLoading}
                  isClearable
                  placeholder={arlsLoading ? 'Cargando ARL…' : 'Buscar o seleccionar ARL (opcional)…'}
                  noOptionsMessage={() => 'Sin resultados'}
                  loadingMessage={() => 'Cargando…'}
                />
              )}
            />
          </div>
        </Card>

        {isPlatformSuper && (
          <Card>
            <CardHeader
              title="4. Módulos habilitados"
              subtitle="Solo el superadministrador de plataforma puede activar o desactivar módulos."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODULE_DEFS.map((mod) => (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => toggleModule(mod.key)}
                  className={`flex flex-col items-start text-left p-4 rounded-summa border-2 transition-all ${
                    modules[mod.key]
                      ? 'border-[#d52680] bg-[#d52680]/8 ring-1 ring-[#d52680]/20'
                      : 'border-summa-border bg-summa-surface hover:border-[#d52680]/40'
                  }`}
                >
                  <span className="flex items-center gap-2 w-full">
                    <span
                      className={`inline-flex h-5 w-5 rounded border-2 flex-shrink-0 items-center justify-center ${
                        modules[mod.key] ? 'bg-[#d52680] border-[#d52680]' : 'border-summa-border bg-white'
                      }`}
                    >
                      {modules[mod.key] && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span
                      className={`text-sm font-bold ${modules[mod.key] ? 'text-[#d52680]' : 'text-summa-ink'}`}
                    >
                      {mod.label}
                    </span>
                    <span className="ml-auto text-[10px] font-semibold text-summa-ink-light uppercase">
                      {modules[mod.key] ? 'Activo' : 'Inactivo'}
                    </span>
                  </span>
                  <p className="text-xs text-summa-ink-light mt-2 pl-7 leading-relaxed">{mod.description}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="5. Archivos e identidad visual" subtitle="Logo, firma, idioma y metadatos. Imágenes máx. 2 MB (JPG, PNG, WebP)." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Logo de la empresa</label>
              <input
                ref={logoInput}
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={onLogoChange}
                className="text-sm text-summa-ink-light file:mr-3 file:py-2 file:px-3 file:rounded-summa file:border-0 file:bg-[#212f87] file:text-white file:text-xs file:font-semibold"
              />
              {logoPreview && (
                <div className="mt-3 relative inline-block max-w-[220px]">
                  <div className="rounded-summa border border-summa-border p-3 bg-white">
                    <img src={logoPreview} alt="Vista previa del logo" className="max-h-28 object-contain mx-auto" />
                  </div>
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => isEdit && clearFileMutation.mutate({ clear_logo: true })}
                      className="mt-2 text-xs font-semibold"
                      style={{ color: '#d52680' }}
                    >
                      Quitar logo actual
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Idioma</label>
              <select {...register('language')} className="input">
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Firma digital (imagen)</label>
              <input
                ref={signatureInput}
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={onSignatureChange}
                className="text-sm text-summa-ink-light file:mr-3 file:py-2 file:px-3 file:rounded-summa file:border-0 file:text-xs file:font-semibold"
              />
              {signaturePreview && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-summa-ink-light">Vista previa (fondo cuadriculado para transparencia)</p>
                  <div
                    className="inline-block max-w-[240px] rounded-summa border border-summa-border p-3"
                    style={{
                      backgroundColor: '#fff',
                      backgroundImage: `
                        linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
                        linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
                        linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)`,
                      backgroundSize: '12px 12px',
                      backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
                    }}
                  >
                    <img src={signaturePreview} alt="Vista previa de la firma" className="max-h-24 object-contain mx-auto" />
                  </div>
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => isEdit && clearFileMutation.mutate({ clear_signature: true })}
                      className="text-xs font-semibold"
                      style={{ color: '#d52680' }}
                    >
                      Quitar firma actual
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Título en certificaciones</label>
              <input {...register('certification_title')} className="input" placeholder="GERENTE" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="6. Representante legal detalle"
            subtitle="Documento y nombres del representante legal (opcional)"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Tipo documento</label>
              <select {...register('tipo_doc_rep_legal')} className="input">
                <option value="">— Sin especificar —</option>
                {REP_LEGAL_DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Número documento</label>
              <input {...register('numero_doc_rep_legal')} className="input" placeholder="Número" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Primer nombre</label>
              <input {...register('pnombre_rep_legal')} className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Segundo nombre</label>
              <input {...register('snombre_rep_legal')} className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Primer apellido</label>
              <input {...register('papellido_rep_legal')} className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Segundo apellido</label>
              <input {...register('sapellido_rep_legal')} className="input" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="7. Contactos por área" subtitle="Personas y correos por función (opcional)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Contacto nómina</label>
              <input {...register('contacto_nomina')} className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Email nómina</label>
              <input type="email" {...register('email_nomina')} className="input" placeholder="nomina@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Contacto RRHH</label>
              <input {...register('contacto_rrhh')} className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Email RRHH</label>
              <input type="email" {...register('email_rrhh')} className="input" placeholder="rrhh@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Contacto contabilidad</label>
              <input {...register('contacto_contabilidad')} className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Email contabilidad</label>
              <input type="email" {...register('email_contabilidad')} className="input" placeholder="contabilidad@empresa.com" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="8. Datos bancarios empresa" subtitle="Cuenta de la compañía para nómina (opcional)" />
          {banksError && (
            <p className="text-sm text-amber-800 mb-3">No se pudieron cargar los bancos. Reintentá recargar la página.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1" htmlFor="tenant-bank">Banco</label>
              <Controller
                name="banco_empresa_id"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="tenant-bank"
                    options={bankOptions}
                    value={field.value ? bankOptions.find((o) => o.value === field.value) ?? null : null}
                    onChange={(opt) => field.onChange(opt?.value ?? '')}
                    isLoading={banksLoading}
                    isDisabled={banksLoading}
                    isClearable
                    placeholder={banksLoading ? 'Cargando bancos…' : 'Buscar o seleccionar banco (opcional)…'}
                    noOptionsMessage={() => (banksError ? 'Error al cargar' : 'Sin resultados')}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Número de cuenta</label>
              <input {...register('num_cuenta_empresa')} className="input font-mono" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Tipo de cuenta</label>
              <select {...register('tipo_cuenta_empresa')} className="input">
                <option value="">— Sin especificar —</option>
                {ACCOUNT_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="9. Configuración PILA" subtitle="Aportes y planilla (opcional)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Clase aportante</label>
              <input {...register('clase_aportante')} className="input" placeholder="Ej. 01" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Tipo aportante</label>
              <input {...register('tipo_aportante')} className="input" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  {...register('empresa_exonerada')}
                  className="rounded border-summa-border"
                  style={{ accentColor: '#d52680' }}
                />
                <span className="text-sm font-semibold text-summa-ink">Empresa exonerada</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  {...register('realizar_parafiscales')}
                  className="rounded border-summa-border"
                  style={{ accentColor: '#d52680' }}
                />
                <span className="text-sm font-semibold text-summa-ink">Realizar parafiscales</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  {...register('vst_ccf')}
                  className="rounded border-summa-border"
                  style={{ accentColor: '#d52680' }}
                />
                <span className="text-sm font-semibold text-summa-ink">Aporta CCF</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  {...register('vst_sena_icbf')}
                  className="rounded border-summa-border"
                  style={{ accentColor: '#d52680' }}
                />
                <span className="text-sm font-semibold text-summa-ink">Aporta SENA/ICBF</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  {...register('ige100')}
                  className="rounded border-summa-border"
                  style={{ accentColor: '#d52680' }}
                />
                <span className="text-sm font-semibold text-summa-ink">IGE 100%</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Tarifa pensión</label>
              <input
                type="text"
                inputMode="decimal"
                {...register('sln_tarifa_pension')}
                className="input font-mono"
                placeholder="16.00"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Tipo planilla</label>
              <select {...register('tipo_presentacion_planilla')} className="input">
                <option value="">— Sin especificar —</option>
                {TIPO_PLANILLA.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Código sucursal</label>
              <input {...register('codigo_sucursal')} className="input font-mono" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Nombre sucursal</label>
              <input {...register('nombre_sucursal')} className="input" />
            </div>
          </div>
        </Card>

        <div className="flex gap-3 flex-wrap">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{ background: '#d52680', borderColor: '#d52680' }}
          >
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear empresa'}
          </button>
          <button type="button" onClick={() => navigate('/admin/tenants')} className="btn-ghost">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
