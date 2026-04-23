import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { personnelApi } from '@/api/personnel'
import { catalogsApi, costCentersApi, subCostCentersApi, workLocationsApi, type WorkCenterItem } from '@/api/catalogs'
import { tenantsApi } from '@/api/tenants'
import apiClient from '@/api/client'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import SelectSearchable, { type SearchableOption } from '@/components/ui/SelectSearchable'
import type { Contract } from '@/types'
import type { AxiosError } from 'axios'

/**
 * Estructura alineada con la pantalla Nomiweb «Modificar contrato» (PDF de referencia):
 * Contrato → Compensación → Seguridad social → Jornada → Retención en la fuente.
 * Campos según `personnel.Contract` / API `ContractSerializer`.
 */
type FormValues = {
  legacy_contract_id: string
  payroll_type: string
  contract_template: string
  hiring_country: string
  hiring_city: string
  contract_type: string
  contract_status: string
  settlement_status: string
  start_date: string
  end_date: string
  position: string
  work_schedule: string
  social_security_status: string
  salary: string
  salary_type: string
  salary_mode: string
  transport_allowance: boolean
  payment_method: string
  bank: string
  bank_account_type: string
  bank_account_number: string
  cost_center: string
  sub_cost_center: string
  eps: string
  afp: string
  severance_fund: string
  ccf: string
  work_location: string
  work_center: string
  contributor_type: string
  contributor_subtype: string
  is_pensioner: string
  pension_risk: boolean
  withholding_method: string
  withholding_percentage: string
  housing_deductible: string
  health_deductible: string
  medical_deductible: string
  dependents: string
  is_current: boolean
  notes: string
}

function intOrNull(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function uuidOrNull(s: string): string | null {
  const t = s.trim()
  return t || null
}

function toPayload(v: FormValues): Record<string, unknown> {
  const salaryNum = Number(String(v.salary).replace(/[^\d.]/g, ''))
  const salaryStr = Number.isFinite(salaryNum) ? salaryNum.toFixed(2) : '0.00'
  return {
    contract_type: intOrNull(v.contract_type) ?? 0,
    contract_template: intOrNull(v.contract_template),
    payroll_type: intOrNull(v.payroll_type),
    hiring_city: intOrNull(v.hiring_city),
    start_date: v.start_date,
    end_date: v.end_date.trim() ? v.end_date : null,
    contract_status: intOrNull(v.contract_status) ?? 1,
    settlement_status: v.settlement_status.trim() || null,
    social_security_status: v.social_security_status.trim() || null,
    salary: salaryStr,
    salary_type: v.salary_type?.trim() ? intOrNull(v.salary_type) : null,
    salary_mode: v.salary_mode,
    transport_allowance: v.transport_allowance,
    payment_method: v.payment_method.trim() || null,
    work_schedule: v.work_schedule.trim() || null,
    bank: intOrNull(v.bank),
    bank_account_number: v.bank_account_number.trim() || null,
    bank_account_type: v.bank_account_type.trim() || null,
    position: v.position,
    cost_center: uuidOrNull(v.cost_center),
    sub_cost_center: uuidOrNull(v.sub_cost_center),
    work_location: uuidOrNull(v.work_location),
    work_center: v.work_center,
    eps: intOrNull(v.eps) ?? 0,
    afp: v.afp.trim() ? intOrNull(v.afp) : null,
    ccf: intOrNull(v.ccf) ?? 0,
    severance_fund: v.severance_fund.trim() ? intOrNull(v.severance_fund) : null,
    contributor_type: v.contributor_type,
    contributor_subtype: v.contributor_subtype.trim() || null,
    is_pensioner: v.is_pensioner.trim() || null,
    pension_risk: v.pension_risk,
    withholding_method: v.withholding_method.trim() || null,
    withholding_percentage: v.withholding_percentage.trim() ? v.withholding_percentage : null,
    housing_deductible: intOrNull(v.housing_deductible),
    health_deductible: intOrNull(v.health_deductible),
    medical_deductible: intOrNull(v.medical_deductible),
    dependents: intOrNull(v.dependents),
    legacy_contract_id: v.legacy_contract_id.trim() || null,
    is_current: v.is_current,
    notes: v.notes.trim() || null,
  }
}

function fieldLabel(
  text: string,
  opts: { required?: boolean } = {},
) {
  return (
    <span className="text-sm font-semibold text-summa-ink block mb-1">
      {text}
      {opts.required && <span className="text-summa-magenta"> *</span>}
    </span>
  )
}

export default function ContractFormPage() {
  const { id: employeeId, contractId } = useParams<{ id: string; contractId?: string }>()
  const isEdit = Boolean(contractId)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: employee, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => personnelApi.employee(employeeId!),
    enabled: !!employeeId,
  })

  const { data: contract, isLoading: loadingContract } = useQuery({
    queryKey: ['contract', employeeId, contractId],
    queryFn: () => personnelApi.contract(employeeId!, contractId!),
    enabled: isEdit && !!employeeId && !!contractId,
  })

  const { data: contractTypes = [], isLoading: loadingCT } = useQuery({
    queryKey: ['catalog', 'contract-types'],
    queryFn: () => catalogsApi.contractTypes(),
  })
  const { data: contractTemplates = [], isLoading: loadingTpl } = useQuery({
    queryKey: ['catalog', 'contract-templates'],
    queryFn: () => catalogsApi.contractTemplates(),
  })
  const { data: payrollTypes = [], isLoading: loadingPT } = useQuery({
    queryKey: ['catalog', 'payroll-types'],
    queryFn: () => catalogsApi.payrollTypes(),
  })
  const { data: salaryTypes = [], isLoading: loadingST } = useQuery({
    queryKey: ['catalog', 'salary-types'],
    queryFn: () => catalogsApi.salaryTypes(),
  })
  const { data: positions = [], isLoading: loadingPos } = useQuery({
    queryKey: ['catalog', 'positions'],
    queryFn: () => catalogsApi.positions(),
  })
  const { data: workCenters = [] } = useQuery({
    queryKey: ['catalog', 'work-centers'],
    queryFn: () => catalogsApi.workCenters(),
  })
  const { data: workLocations = [], isLoading: loadingWL } = useQuery({
    queryKey: ['catalog', 'work-locations'],
    queryFn: () => workLocationsApi.list({ is_active: 'true' }),
  })
  const { data: costCenters = [] } = useQuery({
    queryKey: ['catalog', 'cost-centers'],
    queryFn: () => costCentersApi.list({ is_active: 'true' }),
  })
  const { data: epsList = [] } = useQuery({
    queryKey: ['catalog', 'eps'],
    queryFn: () => catalogsApi.socialSecurityByType('EPS'),
  })
  const { data: afpList = [] } = useQuery({
    queryKey: ['catalog', 'afp'],
    queryFn: () => catalogsApi.socialSecurityByType('AFP'),
  })
  const { data: ccfList = [] } = useQuery({
    queryKey: ['catalog', 'ccf'],
    queryFn: () => catalogsApi.socialSecurityByType('CCF'),
  })
  const { data: cesantiasList = [] } = useQuery({
    queryKey: ['catalog', 'cesantias'],
    queryFn: () => catalogsApi.socialSecurityByType('CESANTIAS'),
  })
  const { data: banks = [] } = useQuery({
    queryKey: ['catalog', 'banks'],
    queryFn: () => catalogsApi.banks(),
  })
  const { data: contributorTypes = [] } = useQuery({
    queryKey: ['catalog', 'contributor-types'],
    queryFn: () => catalogsApi.contributorTypes(),
  })
  const { data: contributorSubtypes = [] } = useQuery({
    queryKey: ['catalog', 'contributor-subtypes'],
    queryFn: () => catalogsApi.contributorSubtypes(),
  })
  const { data: countries = [] } = useQuery({
    queryKey: ['catalog', 'countries', 'contract-hiring'],
    queryFn: () => tenantsApi.getCountries(),
  })

  const { register, handleSubmit, reset, getValues, control, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      legacy_contract_id: '',
      payroll_type: '',
      contract_template: '',
      hiring_country: '',
      hiring_city: '',
      contract_type: '',
      contract_status: '1',
      settlement_status: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      position: '',
      work_schedule: '',
      social_security_status: '',
      salary: '',
      salary_type: '',
      salary_mode: 'fixed',
      transport_allowance: false,
      payment_method: 'transfer',
      bank: '',
      bank_account_type: '',
      bank_account_number: '',
      cost_center: '',
      sub_cost_center: '',
      eps: '',
      afp: '',
      severance_fund: '',
      ccf: '',
      work_location: '',
      work_center: '',
      contributor_type: '',
      contributor_subtype: '',
      is_pensioner: '',
      pension_risk: false,
      withholding_method: '',
      withholding_percentage: '',
      housing_deductible: '',
      health_deductible: '',
      medical_deductible: '',
      dependents: '',
      is_current: true,
      notes: '',
    },
  })

  const defaultContributor = useMemo(
    () => contributorTypes[0]?.code ?? '01',
    [contributorTypes],
  )

  const hiringCountryWatch = useWatch({ control, name: 'hiring_country' })
  const hiringCountryNum = hiringCountryWatch ? Number(hiringCountryWatch) : 0
  const { data: hiringCities = [] } = useQuery({
    queryKey: ['catalog', 'cities', 'hiring', hiringCountryNum],
    queryFn: () => tenantsApi.getCities(hiringCountryNum),
    enabled: hiringCountryNum > 0,
  })

  const costCenterWatch = useWatch({ control, name: 'cost_center' })
  const { data: subCostList = [] } = useQuery({
    queryKey: ['catalog', 'sub-cost-centers', costCenterWatch],
    queryFn: () =>
      costCenterWatch
        ? subCostCentersApi.list({ cost_center: costCenterWatch, is_active: 'true' })
        : Promise.resolve([]),
    enabled: Boolean(costCenterWatch),
  })

  const { data: hiringInit } = useQuery({
    queryKey: ['hiringCityCountry', contractId, contract?.hiring_city],
    queryFn: async () => {
      const cityId = contract!.hiring_city!
      const c = await apiClient.get<{ state_province: number }>(`/catalogs/cities/${cityId}/`)
      const st = await apiClient.get<{ country: number }>(`/catalogs/states/${c.data.state_province}/`)
      return { countryId: st.data.country }
    },
    enabled: isEdit && contract != null && contract.hiring_city != null,
  })

  useEffect(() => {
    if (hiringInit?.countryId != null) {
      setValue('hiring_country', String(hiringInit.countryId))
    }
  }, [hiringInit, setValue])

  useEffect(() => {
    if (!contract) return
    const c = contract as Contract
    const posId = c.position != null ? String(c.position) : ''
    const wlocId = c.work_location != null ? String(c.work_location) : ''
    const ccId = c.cost_center != null ? String(c.cost_center) : ''
    const sccId = c.sub_cost_center != null ? String(c.sub_cost_center) : ''
    const wcId = c.work_center != null ? String(c.work_center) : ''

    reset({
      legacy_contract_id: c.legacy_contract_id ?? '',
      payroll_type: c.payroll_type != null && c.payroll_type !== undefined ? String(c.payroll_type) : '',
      contract_template: c.contract_template != null && c.contract_template !== undefined
        ? String(c.contract_template)
        : '',
      hiring_country: '',
      hiring_city: c.hiring_city != null && c.hiring_city !== undefined ? String(c.hiring_city) : '',
      contract_type: c.contract_type != null && c.contract_type !== undefined ? String(c.contract_type) : '',
      contract_status:
        c.contract_status != null && c.contract_status !== undefined && c.contract_status !== ''
          ? String(c.contract_status)
          : '1',
      settlement_status: c.settlement_status ?? '',
      start_date: c.start_date?.slice(0, 10) ?? '',
      end_date: c.end_date?.slice(0, 10) ?? '',
      position: posId,
      work_schedule: c.work_schedule ?? '',
      social_security_status: c.social_security_status ?? '',
      salary: c.salary != null ? String(c.salary) : '',
      salary_type:
        c.salary_type != null && c.salary_type !== ''
          ? String(c.salary_type as string | number)
          : '',
      salary_mode: c.salary_mode ?? 'fixed',
      transport_allowance: Boolean(c.transport_allowance),
      payment_method: c.payment_method ?? 'transfer',
      bank: c.bank != null && c.bank !== undefined ? String(c.bank) : '',
      bank_account_type: c.bank_account_type ?? '',
      bank_account_number: c.bank_account_number ?? '',
      cost_center: ccId,
      sub_cost_center: sccId,
      eps: c.eps != null && c.eps !== undefined ? String(c.eps) : '',
      afp: c.afp != null && c.afp !== undefined ? String(c.afp) : '',
      severance_fund: c.severance_fund != null && c.severance_fund !== undefined ? String(c.severance_fund) : '',
      ccf: c.ccf != null && c.ccf !== undefined ? String(c.ccf) : '',
      work_location: wlocId,
      work_center: wcId,
      contributor_type: c.contributor_type != null ? String(c.contributor_type) : defaultContributor,
      contributor_subtype: c.contributor_subtype != null ? String(c.contributor_subtype) : '',
      is_pensioner: typeof c.is_pensioner === 'string' ? c.is_pensioner : '',
      pension_risk: Boolean(c.pension_risk),
      withholding_method: c.withholding_method ?? '',
      withholding_percentage: c.withholding_percentage != null ? String(c.withholding_percentage) : '',
      housing_deductible: c.housing_deductible != null ? String(c.housing_deductible) : '',
      health_deductible: c.health_deductible != null ? String(c.health_deductible) : '',
      medical_deductible: c.medical_deductible != null ? String(c.medical_deductible) : '',
      dependents: c.dependents != null ? String(c.dependents) : '',
      is_current: c.is_current !== false,
      notes: c.notes ?? '',
    })
  }, [contract, reset, defaultContributor])

  useEffect(() => {
    if (isEdit || !contributorTypes.length) return
    const code = getValues('contributor_type')
    if (!code) {
      reset({ ...getValues(), contributor_type: contributorTypes[0]!.code })
    }
  }, [contributorTypes, isEdit, getValues, reset])

  const workCenterById = useMemo(
    () => Object.fromEntries((workCenters as WorkCenterItem[]).map((w) => [w.id, w])),
    [workCenters],
  )
  const workCenterId = useWatch({ control, name: 'work_center' })
  const selectedWc = workCenterId ? workCenterById[workCenterId] : undefined

  const positionOptions: SearchableOption[] = useMemo(
    () => positions.map((p) => ({ value: p.id, label: p.name })),
    [positions],
  )
  const hiringCityOptions: SearchableOption[] = useMemo(
    () => hiringCities.map((c) => ({ value: String(c.id), label: c.name })),
    [hiringCities],
  )
  const countryOptions: SearchableOption[] = useMemo(
    () => countries.map((c) => ({ value: String(c.id), label: c.name })),
    [countries],
  )

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = toPayload(values)
      if (isEdit) {
        return personnelApi.updateContract(employeeId!, contractId!, payload)
      }
      return personnelApi.createContract(employeeId!, payload)
    },
    onSuccess: (saved: Contract) => {
      qc.invalidateQueries({ queryKey: ['contracts', employeeId] })
      qc.invalidateQueries({ queryKey: ['contract', employeeId, saved.id] })
      navigate(`/personnel/employees/${employeeId}/contracts/${saved.id}`)
    },
  })

  const err = saveMutation.error as AxiosError<{ detail?: unknown }> | Error | null
  const errMsg = err && 'response' in err && err.response?.data
    ? typeof err.response.data === 'string'
      ? err.response.data
      : JSON.stringify(err.response.data)
    : err?.message

  if (!employeeId) return null
  if (loadingEmployee || !employee) return <LoadingSpinner />
  if (isEdit && loadingContract) return <LoadingSpinner />
  if (isEdit && !contract) {
    return <ErrorAlert message="No se pudo cargar el contrato." />
  }

  const saving = isSubmitting || saveMutation.isPending
  const baseLoading = loadingCT || loadingTpl || loadingPT || loadingST || loadingPos || loadingWL

  const empleadoLine = `${employee.employee_number ? `${employee.employee_number} ` : ''}${employee.full_name} — ${employee.document_type?.code ?? ''} ${employee.document_number}`

  return (
    <div className="animate-fade-in max-w-6xl pb-8">
      <Breadcrumb
        items={[
          { label: 'Personal', to: '/personnel' },
          { label: 'Empleados', to: '/personnel/employees' },
          { label: employee.full_name, to: `/personnel/employees/${employeeId}` },
          { label: isEdit ? 'Modificar contrato' : 'Nuevo contrato' },
        ]}
      />

      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Modificar contrato' : 'Nuevo contrato'}</h1>
        <p className="text-sm text-summa-ink-light mt-1 max-w-3xl">
          Misma lógica de secciones que Nomiweb: contrato, compensación, seguridad social, jornada y retención en la fuente.
        </p>
      </div>

      {baseLoading && <p className="text-sm text-summa-ink-light mb-4">Cargando catálogos…</p>}
      {saveMutation.isError && (
        <ErrorAlert message={errMsg || 'No se pudo guardar el contrato.'} className="mb-4" />
      )}

      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-5">
        {/* ——— Contrato (PDF pág. 1) ——— */}
        <div className="bg-white rounded-summa-lg border border-summa-border p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-summa-ink border-b border-summa-border pb-2 mb-4">
            Contrato
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              {fieldLabel('Id. contrato (Nomiweb / legado)')}
              <input
                {...register('legacy_contract_id')}
                className="input font-mono text-sm"
                readOnly={isEdit}
                placeholder="Ej. 2380"
                maxLength={25}
              />
            </div>
            <div>
              {fieldLabel('Tipo de nómina')}
              <select {...register('payroll_type')} className="input" disabled={!payrollTypes.length}>
                <option value="">— Seleccionar —</option>
                {payrollTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              {fieldLabel('Empleado', { required: true })}
              <div className="input bg-summa-surface/80 text-summa-ink text-sm">
                {empleadoLine}
              </div>
            </div>
            <div>
              {fieldLabel('Lugar de trabajo (ciudad de contratación)')}
              <div className="space-y-2">
                <Controller
                  name="hiring_country"
                  control={control}
                  render={({ field }) => (
                    <SelectSearchable
                      inputId="hiring-country"
                      options={countryOptions}
                      value={field.value ? countryOptions.find((o) => o.value === field.value) ?? null : null}
                      onChange={(opt) => {
                        field.onChange(opt?.value ?? '')
                        setValue('hiring_city', '')
                      }}
                      isClearable
                      placeholder="País (filtra ciudades)…"
                      noOptionsMessage={() => 'Sin resultados'}
                    />
                  )}
                />
                <Controller
                  name="hiring_city"
                  control={control}
                  render={({ field }) => (
                    <SelectSearchable
                      inputId="hiring-city"
                      options={hiringCityOptions}
                      value={field.value ? hiringCityOptions.find((o) => o.value === field.value) ?? null : null}
                      onChange={(opt) => field.onChange(opt?.value ?? '')}
                      isDisabled={!hiringCountryNum}
                      isClearable
                      placeholder={hiringCountryNum ? 'Ciudad (origen)…' : 'Elija un país primero'}
                      noOptionsMessage={() => 'Sin resultados'}
                    />
                  )}
                />
              </div>
            </div>
            <div>
              {fieldLabel('Cargo', { required: true })}
              <Controller
                name="position"
                control={control}
                rules={{ required: 'Seleccione un cargo' }}
                render={({ field }) => (
                  <SelectSearchable
                    inputId="position"
                    options={positionOptions}
                    value={field.value ? positionOptions.find((o) => o.value === field.value) ?? null : null}
                    onChange={(opt) => field.onChange(opt?.value ?? '')}
                    isClearable={false}
                    isDisabled={!positions.length}
                    placeholder="Seleccionar…"
                    noOptionsMessage={() => 'Sin resultados'}
                  />
                )}
              />
              {errors.position && <p className="text-summa-magenta text-xs mt-1">{errors.position.message}</p>}
            </div>
            <div>
              {fieldLabel('Estado del contrato')}
              <select {...register('contract_status')} className="input">
                <option value="1">Activo</option>
                <option value="2">Terminado / finalizado</option>
              </select>
            </div>
            <div>
              {fieldLabel('Fecha inicial del contrato', { required: true })}
              <input type="date" {...register('start_date', { required: 'Requerido' })} className="input" />
              {errors.start_date && <p className="text-summa-magenta text-xs mt-1">{errors.start_date.message}</p>}
            </div>
            <div>
              {fieldLabel('Motivo de retiro (liquidación)')}
              <input {...register('settlement_status')} className="input" placeholder="Solo si aplica" />
            </div>
            <div>
              {fieldLabel('Tipo de contrato', { required: true })}
              <select
                {...register('contract_type', { required: 'Requerido' })}
                className="input"
                disabled={!contractTypes.length}
              >
                <option value="">— Seleccionar —</option>
                {contractTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.dian_code != null ? `${t.dian_code} — ` : ''}{t.name}
                  </option>
                ))}
              </select>
              {errors.contract_type && <p className="text-summa-magenta text-xs mt-1">{errors.contract_type.message}</p>}
            </div>
            <div>
              {fieldLabel('Modelo de contrato')}
              <select {...register('contract_template')} className="input" disabled={!contractTemplates.length}>
                <option value="">— Seleccionar —</option>
                {contractTemplates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {fieldLabel('Fecha de terminación')}
              <input type="date" {...register('end_date')} className="input" />
            </div>
          </div>
        </div>

        {/* ——— Compensación ——— */}
        <div className="bg-white rounded-summa-lg border border-summa-border p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-summa-ink border-b border-summa-border pb-2 mb-4">
            Compensación
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              {fieldLabel('Salario', { required: true })}
              <input {...register('salary', { required: 'Requerido' })} className="input" placeholder="3.720.673" />
              {errors.salary && <p className="text-summa-magenta text-xs mt-1">{errors.salary.message}</p>}
            </div>
            <div>
              {fieldLabel('Tipo de salario')}
              <select {...register('salary_type')} className="input">
                <option value="">— Seleccionar —</option>
                {salaryTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {fieldLabel('Modalidad de salario')}
              <select {...register('salary_mode')} className="input">
                <option value="fixed">Fijo</option>
                <option value="variable">Variable</option>
                <option value="mixed">Mixto</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
              <input type="checkbox" {...register('transport_allowance')} className="rounded border-summa-border" />
              <span className="text-sm text-summa-ink">Auxilio de transporte</span>
            </label>
            <div>
              {fieldLabel('Forma de pago')}
              <select {...register('payment_method')} className="input">
                <option value="">— Sin indicar —</option>
                <option value="transfer">Abono a cuenta / transferencia</option>
                <option value="check">Cheque</option>
                <option value="cash">Efectivo</option>
              </select>
            </div>
            <div>
              {fieldLabel('Banco de la cuenta')}
              <select {...register('bank')} className="input">
                <option value="">— Seleccionar —</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {fieldLabel('Tipo de cuenta')}
              <input {...register('bank_account_type')} className="input" placeholder="Ej. Ahorros" maxLength={15} />
            </div>
            <div className="sm:col-span-2">
              {fieldLabel('Cuenta de nómina')}
              <input {...register('bank_account_number')} className="input font-mono" placeholder="Número de cuenta" maxLength={30} />
            </div>
            <div>
              {fieldLabel('Centro de costos')}
              <select
                {...register('cost_center', {
                  onChange: () => setValue('sub_cost_center', ''),
                })}
                className="input"
              >
                <option value="">— Seleccionar —</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {fieldLabel('Sub centro de costos')}
              <select {...register('sub_cost_center')} className="input" disabled={!costCenterWatch}>
                <option value="">— Seleccionar —</option>
                {subCostList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ——— Seguridad social ——— */}
        <div className="bg-white rounded-summa-lg border border-summa-border p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-summa-ink border-b border-summa-border pb-2 mb-4">
            Seguridad social
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                {fieldLabel('EPS', { required: true })}
                <select {...register('eps', { required: 'Requerido' })} className="input">
                  <option value="">— Seleccionar —</option>
                  {epsList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                {errors.eps && <p className="text-summa-magenta text-xs mt-1">{errors.eps.message}</p>}
              </div>
              <div>
                {fieldLabel('Pensión (AFP / fondo)')}
                <select {...register('afp')} className="input">
                  <option value="">— Seleccionar —</option>
                  {afpList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Fondo de cesantías')}
                <select {...register('severance_fund')} className="input">
                  <option value="">— Seleccionar —</option>
                  {cesantiasList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Caja de compensación (CCF)', { required: true })}
                <select {...register('ccf', { required: 'Requerido' })} className="input">
                  <option value="">— Seleccionar —</option>
                  {ccfList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                {errors.ccf && <p className="text-summa-magenta text-xs mt-1">{errors.ccf.message}</p>}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                {fieldLabel('Centro de trabajo (operador ARL) *')}
                <select {...register('work_center', { required: 'Requerido' })} className="input">
                  <option value="">— Seleccionar —</option>
                  {(workCenters as WorkCenterItem[]).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {selectedWc?.arl_rate != null && (
                  <p className="text-xs text-summa-ink-light mt-1">Tarifa ARL: {selectedWc.arl_rate}</p>
                )}
                {errors.work_center && <p className="text-summa-magenta text-xs mt-1">{errors.work_center.message}</p>}
              </div>
              <div>
                {fieldLabel('Sede de trabajo (ubicación)')}
                <select {...register('work_location')} className="input">
                  <option value="">— Seleccionar —</option>
                  {workLocations.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Tipo de cotizante', { required: true })}
                <select {...register('contributor_type', { required: 'Requerido' })} className="input">
                  <option value="">— Seleccionar —</option>
                  {contributorTypes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.description}
                    </option>
                  ))}
                </select>
                {errors.contributor_type && (
                  <p className="text-summa-magenta text-xs mt-1">{errors.contributor_type.message}</p>
                )}
              </div>
              <div>
                {fieldLabel('Subtipo de cotizante')}
                <select {...register('contributor_subtype')} className="input">
                  <option value="">— Seleccionar —</option>
                  {contributorSubtypes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Pensionado')}
                <select {...register('is_pensioner')} className="input">
                  <option value="">— Sin indicar —</option>
                  <option value="not_applicable">No aplica / no pensionado</option>
                  <option value="active">Pensionado activo</option>
                  <option value="substitution">Sustitución</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('pension_risk')} className="rounded border-summa-border" />
                <span className="text-sm text-summa-ink">Riesgo en pensión (ARL / pensión)</span>
              </label>
            </div>
          </div>
        </div>

        {/* ——— Jornada ——— */}
        <div className="bg-white rounded-summa-lg border border-summa-border p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-summa-ink border-b border-summa-border pb-2 mb-4">
            Jornada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {fieldLabel('Jornada / frecuencia (texto)')}
              <input {...register('work_schedule')} className="input" placeholder="Ej. Quincenal, 8h diarias…" />
            </div>
            <div>
              {fieldLabel('Estado seguridad social (código o texto)')}
              <input {...register('social_security_status')} className="input" />
            </div>
          </div>
        </div>

        {/* ——— Retención en la fuente ——— */}
        <div className="bg-white rounded-summa-lg border border-summa-border p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-summa-ink border-b border-summa-border pb-2 mb-4">
            Retención en la fuente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              {fieldLabel('Método de retefuente')}
              <input {...register('withholding_method')} className="input" placeholder="Ej. Procedimiento 1" />
            </div>
            <div>
              {fieldLabel('Porcentaje de retefuente')}
              <input {...register('withholding_percentage')} className="input" placeholder="0" />
            </div>
            <div>
              {fieldLabel('Salud / retefuente (año anterior)')}
              <input type="number" min={0} step={1} {...register('health_deductible')} className="input" />
            </div>
            <div>
              {fieldLabel('Deducible vivienda')}
              <input type="number" min={0} step={1} {...register('housing_deductible')} className="input" />
            </div>
            <div>
              {fieldLabel('Deducible medicina / prepagada')}
              <input type="number" min={0} step={1} {...register('medical_deductible')} className="input" />
            </div>
            <div>
              {fieldLabel('Dependientes')}
              <input type="number" min={0} step={1} {...register('dependents')} className="input" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-summa-lg border border-summa-border p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-summa-ink border-b border-summa-border pb-2 mb-2">
            Otros
          </h2>
          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input type="checkbox" {...register('is_current')} className="rounded border-summa-border" />
            <span className="text-sm font-semibold text-summa-ink">Contrato actual (marca activo en nómina)</span>
          </label>
          <div>
            {fieldLabel('Notas')}
            <textarea {...register('notes')} className="input min-h-[80px]" rows={3} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving || baseLoading} className="btn-primary">
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear contrato'}
          </button>
          <Link to={`/personnel/employees/${employeeId}`} className="btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
