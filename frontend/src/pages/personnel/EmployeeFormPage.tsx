import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller, type UseFormSetError } from 'react-hook-form'
import { useQuery, useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { personnelApi } from '@/api/personnel'
import { catalogsApi } from '@/api/catalogs'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import SelectSearchable, { type SearchableOption } from '@/components/ui/SelectSearchable'
import type { Employee } from '@/types'

type FormData = {
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
  gender: string
  date_of_birth: string
  marital_status: string
  blood_type: string
  socioeconomic_stratum: string
  profession: number | null
  education_level: string
  employee_number: string
  num_libreta_militar: string
  status: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
}

const EMPTY_FORM: FormData = {
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
  gender: '',
  date_of_birth: '',
  marital_status: '',
  blood_type: '',
  socioeconomic_stratum: '',
  profession: null,
  education_level: '',
  employee_number: '',
  num_libreta_militar: '',
  status: 'active',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
}

function toEmployeeApiBody(data: FormData): Record<string, unknown> {
  const docRaw = String(data.document_number ?? '').replace(/\s/g, '')
  return {
    document_type: data.document_type ?? 0,
    document_number: docRaw ? Number(docRaw) : 0,
    first_name: data.first_name.trim(),
    second_name: data.second_name.trim(),
    first_last_name: data.first_last_name.trim(),
    second_last_name: data.second_last_name.trim(),
    email: data.email.trim(),
    personal_email: data.personal_email.trim(),
    phone: data.phone.trim(),
    cell_phone: data.cell_phone.trim(),
    address: data.address.trim(),
    gender: data.gender,
    date_of_birth: data.date_of_birth || null,
    marital_status: data.marital_status,
    blood_type: data.blood_type,
    socioeconomic_stratum: data.socioeconomic_stratum ? String(data.socioeconomic_stratum) : '',
    profession: data.profession,
    education_level: data.education_level,
    employee_number: data.employee_number.trim(),
    status: data.status,
    num_libreta_militar: data.num_libreta_militar.trim(),
    emergency_contact_name: data.emergency_contact_name.trim(),
    emergency_contact_phone: data.emergency_contact_phone.trim(),
    emergency_contact_relationship: data.emergency_contact_relationship.trim(),
  }
}

function applyServerFieldErrors(err: unknown, setError: UseFormSetError<FormData>) {
  if (!isAxiosError(err) || err.response?.status !== 400) return
  const data = err.response.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return
  const skip = new Set(['detail', 'non_field_errors'])
  for (const [key, val] of Object.entries(data)) {
    if (skip.has(key)) continue
    const message = Array.isArray(val) ? String(val[0]) : String(val)
    setError(key as keyof FormData, { type: 'server', message })
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

  const { register, handleSubmit, reset, control, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: EMPTY_FORM,
  })

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

  useEffect(() => {
    if (employee) {
      const estrato =
        employee.socioeconomic_stratum != null && String(employee.socioeconomic_stratum).trim() !== ''
          ? String(employee.socioeconomic_stratum)
          : ''
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
        gender: employee.gender,
        date_of_birth: employee.date_of_birth ?? '',
        marital_status: employee.marital_status,
        blood_type: employee.blood_type,
        socioeconomic_stratum: estrato,
        profession: employee.profession?.id ?? null,
        education_level: employee.education_level,
        employee_number: employee.employee_number,
        num_libreta_militar: employee.num_libreta_militar ?? '',
        status: employee.status,
        emergency_contact_name: employee.emergency_contact_name,
        emergency_contact_phone: employee.emergency_contact_phone,
        emergency_contact_relationship: employee.emergency_contact_relationship,
      })
    }
  }, [employee, reset])

  const createMutation = useMutation({
    mutationFn: (d: FormData) => personnelApi.createEmployee(toEmployeeApiBody(d) as Partial<Employee>),
    onSuccess: (e) => navigate(`/personnel/employees/${e.id}`),
    onError: (err) => applyServerFieldErrors(err, setError),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => personnelApi.updateEmployee(id!, toEmployeeApiBody(d) as Partial<Employee>),
    onSuccess: () => navigate(`/personnel/employees/${id}`),
    onError: (err) => applyServerFieldErrors(err, setError),
  })

  const onSubmit = (data: FormData) => (isEdit ? updateMutation.mutate(data) : createMutation.mutate(data))
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
