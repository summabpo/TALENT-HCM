import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller, useWatch, type UseFormSetError } from 'react-hook-form'
import { useQuery, useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { personnelApi } from '@/api/personnel'
import { catalogsApi } from '@/api/catalogs'
import { tenantsApi } from '@/api/tenants'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import SelectSearchable, { type SearchableOption } from '@/components/ui/SelectSearchable'
import type { CityNested, CountryNested, Employee } from '@/types'

const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
const RESUME_MAX_BYTES = 3 * 1024 * 1024
const PDF_ACCEPT = 'application/pdf'

type EmployeeFormValues = {
  document_type: number | null
  document_number: string
  first_name: string
  second_name: string
  first_last_name: string
  second_last_name: string
  email: string
  personal_email: string
  phone: string
  cell_phone: string
  address: string
  /** Solo UI: filtra ciudades de expedición */
  expedition_country: number | null
  document_expedition_date: string
  document_expedition_city: number | null
  birth_country: number | null
  birth_city: number | null
  gender: string
  date_of_birth: string
  marital_status: string
  blood_type: string
  socioeconomic_stratum: string
  profession: number | null
  education_level: string
  employee_number: string
  num_libreta_militar: string
  weight: string
  height: string
  uniform_pants: string
  uniform_shirt: string
  uniform_shoes: string
  status: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  residence_country: number | null
  residence_city: number | null
}

const EMPTY_FORM: EmployeeFormValues = {
  document_type: null,
  document_number: '',
  first_name: '',
  second_name: '',
  first_last_name: '',
  second_last_name: '',
  email: '',
  personal_email: '',
  phone: '',
  cell_phone: '',
  address: '',
  expedition_country: null,
  document_expedition_date: '',
  document_expedition_city: null,
  birth_country: null,
  birth_city: null,
  gender: '',
  date_of_birth: '',
  marital_status: '',
  blood_type: '',
  socioeconomic_stratum: '',
  profession: null,
  education_level: '',
  employee_number: '',
  num_libreta_militar: '',
  weight: '',
  height: '',
  uniform_pants: '',
  uniform_shirt: '',
  uniform_shoes: '',
  status: 'active',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  residence_country: null,
  residence_city: null,
}

function countryIdFromDetail(
  country: CountryNested | null | undefined,
  city: CityNested | null | undefined,
): number | null {
  if (country?.id != null) return country.id
  if (city?.country_id != null) return city.country_id
  return null
}

function toEmployeeApiBody(data: EmployeeFormValues): Record<string, unknown> {
  const { expedition_country: _e, ...rest } = data
  void _e
  const docRaw = String(rest.document_number ?? '').replace(/\s/g, '')
  return {
    document_type: rest.document_type ?? 0,
    document_number: docRaw ? Number(docRaw) : 0,
    first_name: rest.first_name.trim(),
    second_name: rest.second_name.trim(),
    first_last_name: rest.first_last_name.trim(),
    second_last_name: rest.second_last_name.trim(),
    email: rest.email.trim(),
    personal_email: rest.personal_email.trim(),
    phone: rest.phone.trim(),
    cell_phone: rest.cell_phone.trim(),
    address: rest.address.trim(),
    gender: rest.gender,
    date_of_birth: rest.date_of_birth || null,
    marital_status: rest.marital_status,
    blood_type: rest.blood_type,
    socioeconomic_stratum: rest.socioeconomic_stratum
      ? String(rest.socioeconomic_stratum)
      : '',
    weight: rest.weight.trim(),
    height: rest.height.trim(),
    profession: rest.profession,
    education_level: rest.education_level,
    employee_number: rest.employee_number.trim(),
    status: rest.status,
    num_libreta_militar: rest.num_libreta_militar.trim(),
    uniform_pants: rest.uniform_pants.trim(),
    uniform_shirt: rest.uniform_shirt.trim(),
    uniform_shoes: rest.uniform_shoes.trim(),
    emergency_contact_name: rest.emergency_contact_name.trim(),
    emergency_contact_phone: rest.emergency_contact_phone.trim(),
    emergency_contact_relationship: rest.emergency_contact_relationship.trim(),
    document_expedition_date: rest.document_expedition_date || null,
    document_expedition_city: rest.document_expedition_city,
    birth_country: rest.birth_country,
    birth_city: rest.birth_city,
    residence_country: rest.residence_country,
    residence_city: rest.residence_city,
  }
}

function bodyToFormData(body: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [key, v] of Object.entries(body)) {
    if (v === undefined) continue
    if (v === null) {
      fd.append(key, '')
      continue
    }
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

function validateResumeFile(f: File | undefined): string | null {
  if (!f) return null
  if (f.size > RESUME_MAX_BYTES) {
    return 'El PDF no puede superar 3 MB.'
  }
  const okType = f.type === PDF_ACCEPT || f.type === '' // algunos browsers dejan type vacío
  const okName = (f.name || '').toLowerCase().endsWith('.pdf')
  if (!okType && !okName) {
    return 'Solo se acepta un archivo PDF.'
  }
  return null
}

function applyServerFieldErrors(err: unknown, setError: UseFormSetError<EmployeeFormValues>) {
  if (!isAxiosError(err) || err.response?.status !== 400) return
  const data = err.response.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return
  const skip = new Set(['detail', 'non_field_errors', 'resume_file', 'photo'])
  for (const [key, val] of Object.entries(data)) {
    if (skip.has(key)) continue
    if (!(key in EMPTY_FORM)) continue
    const message = Array.isArray(val) ? String(val[0]) : String(val)
    setError(key as keyof EmployeeFormValues, { type: 'server', message })
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-summa-lg border border-summa-border p-6">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-summa-ink mb-1">
        {label}
        {required && (
          <span className="ml-0.5 font-bold" style={{ color: '#d52680' }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-sm mt-1" style={{ color: '#d52680' }}>{error}</p>}
    </div>
  )
}

export default function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const photoInput = useRef<HTMLInputElement>(null)
  const resumeInput = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => personnelApi.employee(id!),
    enabled: isEdit,
  })

  const { data: professions = [], isLoading: professionsLoading } = useQuery({
    queryKey: ['catalog', 'professions'],
    queryFn: () => catalogsApi.professions(),
  })

  const { data: documentTypes = [], isLoading: documentTypesLoading } = useQuery({
    queryKey: ['catalog', 'document-types'],
    queryFn: () => catalogsApi.documentTypes(),
  })

  const { data: countries = [], isLoading: countriesLoading } = useQuery({
    queryKey: ['catalog', 'countries'],
    queryFn: () => tenantsApi.getCountries(),
  })

  const { register, handleSubmit, reset, control, setError, setValue, formState: { errors, isSubmitting } } = useForm<EmployeeFormValues>({
    defaultValues: EMPTY_FORM,
  })

  const birthCountryId = useWatch({ control, name: 'birth_country' })
  const residenceCountryId = useWatch({ control, name: 'residence_country' })
  const expeditionCountryId = useWatch({ control, name: 'expedition_country' })

  const birthCountryNum = birthCountryId && birthCountryId > 0 ? birthCountryId : 0
  const residenceCountryNum = residenceCountryId && residenceCountryId > 0 ? residenceCountryId : 0
  const expeditionCountryNum = expeditionCountryId && expeditionCountryId > 0 ? expeditionCountryId : 0

  const { data: birthCities = [], isPending: birthCitiesPending } = useQuery({
    queryKey: ['catalog', 'cities', 'birth', birthCountryNum],
    queryFn: () => tenantsApi.getCities(birthCountryNum),
    enabled: birthCountryNum > 0,
  })
  const { data: residenceCities = [], isPending: residenceCitiesPending } = useQuery({
    queryKey: ['catalog', 'cities', 'residence', residenceCountryNum],
    queryFn: () => tenantsApi.getCities(residenceCountryNum),
    enabled: residenceCountryNum > 0,
  })
  const { data: expeditionCities = [], isPending: expeditionCitiesPending } = useQuery({
    queryKey: ['catalog', 'cities', 'expedition', expeditionCountryNum],
    queryFn: () => tenantsApi.getCities(expeditionCountryNum),
    enabled: expeditionCountryNum > 0,
  })

  const countryOptions = useMemo<SearchableOption[]>(
    () => countries.map((c) => ({ value: String(c.id), label: c.name })),
    [countries],
  )

  const professionOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = professions.map((p) => ({ value: String(p.id), label: p.name }))
    if (employee?.profession) {
      const pid = String(employee.profession.id)
      if (!fromApi.some((o) => o.value === pid)) {
        return [{ value: pid, label: employee.profession.name }, ...fromApi]
      }
    }
    return fromApi
  }, [professions, employee])

  const documentTypeOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = documentTypes.map((d) => ({
      value: String(d.id),
      label: `${d.code} — ${d.name}`,
    }))
    if (employee?.document_type) {
      const tid = String(employee.document_type.id)
      if (!fromApi.some((o) => o.value === tid)) {
        const d = employee.document_type
        return [{ value: tid, label: `${d.code} — ${d.name}` }, ...fromApi]
      }
    }
    return fromApi
  }, [documentTypes, employee])

  const birthCityOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = birthCities.map((c) => ({ value: String(c.id), label: c.name }))
    if (employee?.birth_city && countryIdFromDetail(employee.birth_country, employee.birth_city) === birthCountryNum) {
      const cid = String(employee.birth_city.id)
      if (!fromApi.some((o) => o.value === cid)) {
        return [{ value: cid, label: employee.birth_city.name }, ...fromApi]
      }
    }
    return fromApi
  }, [birthCities, employee, birthCountryNum])

  const residenceCityOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = residenceCities.map((c) => ({ value: String(c.id), label: c.name }))
    if (employee?.residence_city
      && countryIdFromDetail(employee.residence_country, employee.residence_city) === residenceCountryNum) {
      const cid = String(employee.residence_city.id)
      if (!fromApi.some((o) => o.value === cid)) {
        return [{ value: cid, label: employee.residence_city.name }, ...fromApi]
      }
    }
    return fromApi
  }, [residenceCities, employee, residenceCountryNum])

  const expeditionCityOptions = useMemo<SearchableOption[]>(() => {
    const fromApi = expeditionCities.map((c) => ({ value: String(c.id), label: c.name }))
    if (employee?.document_expedition_city && employee.document_expedition_city.country_id === expeditionCountryNum) {
      const cid = String(employee.document_expedition_city.id)
      if (!fromApi.some((o) => o.value === cid)) {
        return [{ value: cid, label: employee.document_expedition_city.name }, ...fromApi]
      }
    }
    return fromApi
  }, [expeditionCities, employee, expeditionCountryNum])

  useEffect(() => {
    if (employee) {
      const estrato =
        employee.socioeconomic_stratum != null && String(employee.socioeconomic_stratum).trim() !== ''
          ? String(employee.socioeconomic_stratum)
          : ''
      const expCountry = countryIdFromDetail(undefined, employee.document_expedition_city)
      reset({
        document_type: employee.document_type.id,
        document_number: String(employee.document_number ?? ''),
        first_name: employee.first_name,
        second_name: employee.second_name,
        first_last_name: employee.first_last_name,
        second_last_name: employee.second_last_name,
        email: employee.email,
        personal_email: employee.personal_email,
        phone: employee.phone,
        cell_phone: employee.cell_phone,
        address: employee.address,
        expedition_country: expCountry,
        document_expedition_date: employee.document_expedition_date ?? '',
        document_expedition_city: employee.document_expedition_city?.id ?? null,
        birth_country: countryIdFromDetail(employee.birth_country, employee.birth_city),
        birth_city: employee.birth_city?.id ?? null,
        gender: employee.gender,
        date_of_birth: employee.date_of_birth ?? '',
        marital_status: employee.marital_status,
        blood_type: employee.blood_type,
        socioeconomic_stratum: estrato,
        profession: employee.profession?.id ?? null,
        education_level: employee.education_level,
        employee_number: employee.employee_number,
        num_libreta_militar: employee.num_libreta_militar ?? '',
        weight: employee.weight ?? '',
        height: employee.height ?? '',
        uniform_pants: employee.uniform_pants ?? '',
        uniform_shirt: employee.uniform_shirt ?? '',
        uniform_shoes: employee.uniform_shoes ?? '',
        status: employee.status,
        emergency_contact_name: employee.emergency_contact_name,
        emergency_contact_phone: employee.emergency_contact_phone,
        emergency_contact_relationship: employee.emergency_contact_relationship,
        residence_country: countryIdFromDetail(employee.residence_country, employee.residence_city),
        residence_city: employee.residence_city?.id ?? null,
      })
      setPhotoPreview(employee.photo ?? null)
    }
  }, [employee, reset])

  const runSave = async (values: EmployeeFormValues, photoFile: File | null, resumeFile: File | null) => {
    const body = toEmployeeApiBody(values)
    const multipart = photoFile != null || resumeFile != null
    if (multipart) {
      const fd = bodyToFormData(body)
      if (photoFile) fd.append('photo', photoFile)
      if (resumeFile) fd.append('resume_file', resumeFile)
      if (isEdit) return personnelApi.updateEmployeeForm(id!, fd)
      return personnelApi.createEmployeeForm(fd)
    }
    if (isEdit) return personnelApi.updateEmployee(id!, body as Partial<Employee>)
    return personnelApi.createEmployee(body as Partial<Employee>)
  }

  const createMutation = useMutation({
    mutationFn: ({
      values,
      photoFile,
      resumeFile,
    }: { values: EmployeeFormValues; photoFile: File | null; resumeFile: File | null }) =>
      runSave(values, photoFile, resumeFile),
    onSuccess: (e) => navigate(`/personnel/employees/${e.id}`),
    onError: (err) => {
      applyServerFieldErrors(err, setError)
      if (isAxiosError(err) && err.response?.status === 400) {
        const d = err.response.data
        if (d && typeof d === 'object' && !Array.isArray(d) && d.resume_file) {
          const m = Array.isArray(d.resume_file) ? d.resume_file[0] : d.resume_file
          setFileError(String(m))
        }
        if (d && typeof d === 'object' && !Array.isArray(d) && d.photo) {
          const m = Array.isArray(d.photo) ? d.photo[0] : d.photo
          setFileError(String(m))
        }
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      values,
      photoFile,
      resumeFile,
    }: { values: EmployeeFormValues; photoFile: File | null; resumeFile: File | null }) =>
      runSave(values, photoFile, resumeFile),
    onSuccess: () => navigate(`/personnel/employees/${id}`),
    onError: (err) => {
      applyServerFieldErrors(err, setError)
      if (isAxiosError(err) && err.response?.status === 400) {
        const d = err.response.data
        if (d && typeof d === 'object' && !Array.isArray(d) && d.resume_file) {
          const m = Array.isArray(d.resume_file) ? d.resume_file[0] : d.resume_file
          setFileError(String(m))
        }
        if (d && typeof d === 'object' && !Array.isArray(d) && d.photo) {
          const m = Array.isArray(d.photo) ? d.photo[0] : d.photo
          setFileError(String(m))
        }
      }
    },
  })

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const f = e.target.files?.[0]
    if (f) {
      const err = validateImageFile(f)
      if (err) {
        setFileError(err)
        e.target.value = ''
        return
      }
      if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
      setPhotoPreview(URL.createObjectURL(f))
    }
  }

  const onResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const f = e.target.files?.[0]
    if (f) {
      const err = validateResumeFile(f)
      if (err) {
        setFileError(err)
        e.target.value = ''
      }
    }
  }

  const onSubmit = (values: EmployeeFormValues) => {
    const photoFile = photoInput.current?.files?.[0] ?? null
    const resumeFile = resumeInput.current?.files?.[0] ?? null
    if (photoFile) {
      const e = validateImageFile(photoFile)
      if (e) {
        setFileError(e)
        return
      }
    }
    if (resumeFile) {
      const e = validateResumeFile(resumeFile)
      if (e) {
        setFileError(e)
        return
      }
    }
    setFileError(null)
    const payload = { values, photoFile, resumeFile }
    if (isEdit) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const apiError = (createMutation.error || updateMutation.error) as Error | null
  const saving = isSubmitting || createMutation.isPending || updateMutation.isPending

  if (isEdit && isLoading) return <LoadingSpinner />

  const breadcrumbs = isEdit
    ? [{ label: 'Personal', to: '/personnel' }, { label: 'Empleados', to: '/personnel/employees' }, { label: employee?.full_name ?? '…', to: `/personnel/employees/${id}` }, { label: 'Editar' }]
    : [{ label: 'Personal', to: '/personnel' }, { label: 'Empleados', to: '/personnel/employees' }, { label: 'Nuevo empleado' }]

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={breadcrumbs} />
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</h1>
      </div>

      {apiError && (
        <ErrorAlert message="Error al guardar. Verifica los datos." error={apiError} className="mb-4" />
      )}
      {fileError && (
        <ErrorAlert message={fileError} className="mb-4" onRetry={() => setFileError(null)} />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Section title="Identificación">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Tipo de documento" required error={errors.document_type?.message}>
              <Controller
                name="document_type"
                control={control}
                rules={{ validate: (v) => (v != null && v > 0 ? true : 'Seleccione un tipo de documento') }}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-document-type"
                    options={documentTypeOptions}
                    value={
                      field.value != null
                        ? documentTypeOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => field.onChange(opt ? Number(opt.value) : null)}
                    isLoading={documentTypesLoading}
                    isDisabled={documentTypesLoading}
                    isClearable={false}
                    placeholder={
                      documentTypesLoading ? 'Cargando tipos de documento…' : 'Buscar o elegir tipo de documento…'
                    }
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
            <Field label="Número de documento" required error={errors.document_number?.message}>
              <input {...register('document_number', { required: 'Requerido' })} className="input" />
            </Field>
            <Field label="N° empleado" error={errors.employee_number?.message}>
              <input {...register('employee_number')} className="input" placeholder="Ej. EMP-001" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-semibold text-summa-ink mb-1">Foto</label>
              <input
                ref={photoInput}
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={onPhotoChange}
                className="text-sm text-summa-ink-light file:mr-3 file:py-2 file:px-3 file:rounded-summa file:border-0 file:bg-[#212f87] file:text-white file:text-xs file:font-semibold"
              />
              <p className="text-xs text-summa-ink-light mt-1">JPG, PNG o WebP, máx. 2 MB.</p>
              {photoPreview && (
                <div className="mt-3 rounded-summa border border-summa-border p-3 bg-white inline-block max-w-[200px]">
                  <img src={photoPreview} alt="Vista previa" className="max-h-32 object-contain mx-auto" />
                </div>
              )}
            </div>
            <Field label="Fecha de expedición del documento" error={errors.document_expedition_date?.message}>
              <input type="date" {...register('document_expedition_date')} className="input" />
            </Field>
            <Field label="País de expedición">
              <Controller
                name="expedition_country"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-exp-country"
                    options={countryOptions}
                    value={
                      field.value != null
                        ? countryOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => {
                      field.onChange(opt ? Number(opt.value) : null)
                      setValue('document_expedition_city', null)
                    }}
                    isLoading={countriesLoading}
                    isDisabled={countriesLoading}
                    isClearable
                    placeholder={countriesLoading ? 'Cargando…' : 'Buscar o elegir país…'}
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
            <Field label="Ciudad de expedición" error={errors.document_expedition_city?.message}>
              <Controller
                name="document_expedition_city"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-exp-city"
                    options={expeditionCityOptions}
                    value={
                      field.value != null
                        ? expeditionCityOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => field.onChange(opt ? Number(opt.value) : null)}
                    isLoading={expeditionCitiesPending}
                    isDisabled={!expeditionCountryNum || expeditionCitiesPending}
                    isClearable
                    placeholder={
                      !expeditionCountryNum
                        ? 'Elija primero un país'
                        : expeditionCitiesPending
                          ? 'Cargando ciudades…'
                          : 'Buscar o elegir ciudad…'
                    }
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
            <Field label="N° libreta militar">
              <input {...register('num_libreta_militar')} className="input" placeholder="Ej. 1234567890" maxLength={10} />
            </Field>
          </div>
        </Section>

        <Section title="Datos personales">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Primer nombre" required error={errors.first_name?.message}>
              <input {...register('first_name', { required: 'Requerido' })} className="input" />
            </Field>
            <Field label="Segundo nombre">
              <input {...register('second_name')} className="input" />
            </Field>
            <Field label="Primer apellido" required error={errors.first_last_name?.message}>
              <input {...register('first_last_name', { required: 'Requerido' })} className="input" />
            </Field>
            <Field label="Segundo apellido">
              <input {...register('second_last_name')} className="input" />
            </Field>
            <Field label="País de nacimiento" error={errors.birth_country?.message}>
              <Controller
                name="birth_country"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-birth-country"
                    options={countryOptions}
                    value={
                      field.value != null
                        ? countryOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => {
                      field.onChange(opt ? Number(opt.value) : null)
                      setValue('birth_city', null)
                    }}
                    isLoading={countriesLoading}
                    isDisabled={countriesLoading}
                    isClearable
                    placeholder={countriesLoading ? 'Cargando…' : 'Buscar o elegir país…'}
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
            <Field label="Ciudad de nacimiento" error={errors.birth_city?.message}>
              <Controller
                name="birth_city"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-birth-city"
                    options={birthCityOptions}
                    value={
                      field.value != null
                        ? birthCityOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => field.onChange(opt ? Number(opt.value) : null)}
                    isLoading={birthCitiesPending}
                    isDisabled={!birthCountryNum || birthCitiesPending}
                    isClearable
                    placeholder={
                      !birthCountryNum
                        ? 'Elija primero un país'
                        : birthCitiesPending
                          ? 'Cargando ciudades…'
                          : 'Buscar o elegir ciudad…'
                    }
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
            <Field label="Género">
              <select {...register('gender')} className="input">
                <option value="">— Seleccionar —</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </Field>
            <Field label="Fecha de nacimiento">
              <input type="date" {...register('date_of_birth')} className="input" />
            </Field>
            <Field label="Estado civil">
              <select {...register('marital_status')} className="input">
                <option value="">— Seleccionar —</option>
                <option value="single">Soltero/a</option>
                <option value="married">Casado/a</option>
                <option value="divorced">Divorciado/a</option>
                <option value="widowed">Viudo/a</option>
                <option value="free_union">Unión libre</option>
              </select>
            </Field>
            <Field label="Grupo sanguíneo">
              <select {...register('blood_type')} className="input">
                <option value="">— Seleccionar —</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estrato socioeconómico" error={errors.socioeconomic_stratum?.message}>
              <select {...register('socioeconomic_stratum')} className="input">
                <option value="">— Sin indicar —</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Contacto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Correo corporativo" required error={errors.email?.message}>
              <input type="email" {...register('email', { required: 'Requerido' })} className="input" />
            </Field>
            <Field label="Correo personal">
              <input type="email" {...register('personal_email')} className="input" />
            </Field>
            <Field label="Celular">
              <input {...register('cell_phone')} className="input" />
            </Field>
            <Field label="Teléfono">
              <input {...register('phone')} className="input" />
            </Field>
            <Field label="Dirección">
              <input {...register('address')} className="input" />
            </Field>
            <Field label="País de residencia" error={errors.residence_country?.message}>
              <Controller
                name="residence_country"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-residence-country"
                    options={countryOptions}
                    value={
                      field.value != null
                        ? countryOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => {
                      field.onChange(opt ? Number(opt.value) : null)
                      setValue('residence_city', null)
                    }}
                    isLoading={countriesLoading}
                    isDisabled={countriesLoading}
                    isClearable
                    placeholder={countriesLoading ? 'Cargando…' : 'Buscar o elegir país…'}
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
            <Field label="Ciudad de residencia" error={errors.residence_city?.message}>
              <Controller
                name="residence_city"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-residence-city"
                    options={residenceCityOptions}
                    value={
                      field.value != null
                        ? residenceCityOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => field.onChange(opt ? Number(opt.value) : null)}
                    isLoading={residenceCitiesPending}
                    isDisabled={!residenceCountryNum || residenceCitiesPending}
                    isClearable
                    placeholder={
                      !residenceCountryNum
                        ? 'Elija primero un país'
                        : residenceCitiesPending
                          ? 'Cargando ciudades…'
                          : 'Buscar o elegir ciudad…'
                    }
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
          </div>
        </Section>

        <Section title="Formación académica">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Profesión" error={errors.profession?.message}>
              <Controller
                name="profession"
                control={control}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="employee-profession"
                    options={professionOptions}
                    value={
                      field.value != null
                        ? professionOptions.find((o) => o.value === String(field.value)) ?? null
                        : null
                    }
                    onChange={(opt) => field.onChange(opt ? Number(opt.value) : null)}
                    isLoading={professionsLoading}
                    isDisabled={professionsLoading}
                    isClearable
                    placeholder={professionsLoading ? 'Cargando profesiones…' : 'Buscar o elegir profesión (opcional)…'}
                    noOptionsMessage={() => 'Sin resultados'}
                    loadingMessage={() => 'Cargando…'}
                  />
                )}
              />
            </Field>
            <Field label="Nivel educativo">
              <select {...register('education_level')} className="input">
                <option value="">— Seleccionar —</option>
                <option value="primary">Primaria</option>
                <option value="secondary">Secundaria</option>
                <option value="technical">Técnico</option>
                <option value="technological">Tecnológico</option>
                <option value="undergraduate">Pregrado</option>
                <option value="postgraduate">Posgrado</option>
                <option value="master">Maestría</option>
                <option value="doctorate">Doctorado</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Datos físicos">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Field label="Peso (kg)" error={errors.weight?.message}>
              <input {...register('weight')} className="input" placeholder="Ej. 70" maxLength={10} />
            </Field>
            <Field label="Estatura (cm)" error={errors.height?.message}>
              <input {...register('height')} className="input" placeholder="Ej. 175" maxLength={10} />
            </Field>
          </div>
        </Section>

        <Section title="Dotación (tallas)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Talla pantalón" error={errors.uniform_pants?.message}>
              <input {...register('uniform_pants')} className="input" maxLength={10} />
            </Field>
            <Field label="Talla camisa" error={errors.uniform_shirt?.message}>
              <input {...register('uniform_shirt')} className="input" maxLength={10} />
            </Field>
            <Field label="Talla zapatos" error={errors.uniform_shoes?.message}>
              <input {...register('uniform_shoes')} className="input" maxLength={10} />
            </Field>
          </div>
        </Section>

        <Section title="Hoja de vida">
          <div className="max-w-xl space-y-2">
            <label className="block text-sm font-semibold text-summa-ink">Archivo PDF (máx. 3 MB)</label>
            <input
              ref={resumeInput}
              type="file"
              accept="application/pdf,.pdf"
              onChange={onResumeChange}
              className="text-sm text-summa-ink-light file:mr-3 file:py-2 file:px-3 file:rounded-summa file:border-0 file:bg-[#212f87] file:text-white file:text-xs file:font-semibold"
            />
            {isEdit && employee?.resume_file && (
              <p className="text-sm text-summa-ink">
                Archivo actual:{' '}
                <a
                  href={employee.resume_file}
                  target="_blank"
                  rel="noreferrer"
                  className="text-summa-navy font-semibold hover:text-summa-magenta"
                >
                  Ver PDF
                </a>
              </p>
            )}
          </div>
        </Section>

        <Section title="Contacto de emergencia">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Nombre">
              <input {...register('emergency_contact_name')} className="input" />
            </Field>
            <Field label="Teléfono">
              <input {...register('emergency_contact_phone')} className="input" />
            </Field>
            <Field label="Parentesco">
              <input {...register('emergency_contact_relationship')} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Estado laboral">
          <div className="max-w-xs">
            <Field label="Estado">
              <select {...register('status')} className="input">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="on_leave">En licencia o ausencia</option>
                <option value="terminated">Retirado</option>
              </select>
            </Field>
          </div>
        </Section>

        <div className="flex gap-3 pb-6">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/personnel/employees/${id}` : '/personnel/employees')}
            className="btn-ghost"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
