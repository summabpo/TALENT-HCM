import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { personnelApi } from '@/api/personnel'
import { catalogsApi } from '@/api/catalogs'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import { Card, CardHeader } from '@/components/ui/Card'
import type { Contract } from '@/types'
import type { AxiosError } from 'axios'

type FormValues = {
  contract_type: string
  start_date: string
  end_date: string
  salary: string
  salary_mode: string
  salary_type: string
  transport_allowance: boolean
  position: string
  work_center: string
  eps: string
  ccf: string
  contributor_type: string
  is_current: boolean
  notes: string
}

function toPayload(v: FormValues): Record<string, unknown> {
  const salaryNum = Number(String(v.salary).replace(/[^\d.]/g, ''))
  const salaryStr = Number.isFinite(salaryNum) ? salaryNum.toFixed(2) : '0.00'
  return {
    contract_type: Number(v.contract_type),
    start_date: v.start_date,
    end_date: v.end_date.trim() ? v.end_date : null,
    salary: salaryStr,
    salary_mode: v.salary_mode,
    salary_type: v.salary_type?.trim() ? Number(v.salary_type) : null,
    transport_allowance: v.transport_allowance,
    position: v.position,
    work_center: v.work_center,
    eps: Number(v.eps),
    ccf: Number(v.ccf),
    contributor_type: v.contributor_type,
    is_current: v.is_current,
    notes: v.notes.trim(),
  }
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
  const { data: salaryTypes = [], isLoading: loadingST } = useQuery({
    queryKey: ['catalog', 'salary-types'],
    queryFn: () => catalogsApi.salaryTypes(),
  })
  const { data: positions = [], isLoading: loadingPos } = useQuery({
    queryKey: ['catalog', 'positions'],
    queryFn: () => catalogsApi.positions(),
  })
  const { data: workCenters = [], isLoading: loadingWc } = useQuery({
    queryKey: ['catalog', 'work-centers'],
    queryFn: () => catalogsApi.workCenters(),
  })
  const { data: epsList = [], isLoading: loadingEps } = useQuery({
    queryKey: ['catalog', 'eps'],
    queryFn: () => catalogsApi.socialSecurityByType('EPS'),
  })
  const { data: ccfList = [], isLoading: loadingCcf } = useQuery({
    queryKey: ['catalog', 'ccf'],
    queryFn: () => catalogsApi.socialSecurityByType('CCF'),
  })
  const { data: contributorTypes = [], isLoading: loadingContrib } = useQuery({
    queryKey: ['catalog', 'contributor-types'],
    queryFn: () => catalogsApi.contributorTypes(),
  })

  const catalogsLoading =
    loadingCT || loadingST || loadingPos || loadingWc || loadingEps || loadingCcf || loadingContrib

  const defaultContributor = useMemo(
    () => contributorTypes[0]?.code ?? '01',
    [contributorTypes],
  )

  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      contract_type: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      salary: '',
      salary_mode: 'fixed',
      salary_type: '',
      transport_allowance: false,
      position: '',
      work_center: '',
      eps: '',
      ccf: '',
      contributor_type: '',
      is_current: true,
      notes: '',
    },
  })

  useEffect(() => {
    if (!contract) return
    const c = contract as Contract
    reset({
      contract_type: c.contract_type != null ? String(c.contract_type) : '',
      start_date: c.start_date?.slice(0, 10) ?? '',
      end_date: c.end_date?.slice(0, 10) ?? '',
      salary: c.salary != null ? String(c.salary) : '',
      salary_mode: c.salary_mode ?? 'fixed',
      salary_type:
        c.salary_type != null && c.salary_type !== ''
          ? String(c.salary_type as string | number)
          : '',
      transport_allowance: Boolean(c.transport_allowance),
      position: c.position != null ? String(c.position) : '',
      work_center: c.work_center != null ? String(c.work_center) : '',
      eps: c.eps != null ? String(c.eps) : '',
      ccf: c.ccf != null ? String(c.ccf) : '',
      contributor_type: c.contributor_type != null ? String(c.contributor_type) : defaultContributor,
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
  const catalogsEmpty =
    !catalogsLoading &&
    (!contractTypes.length ||
      !positions.length ||
      !workCenters.length ||
      !epsList.length ||
      !ccfList.length ||
      !contributorTypes.length)

  return (
    <div className="animate-fade-in max-w-4xl pb-8">
      <Breadcrumb
        items={[
          { label: 'Personal', to: '/personnel' },
          { label: 'Empleados', to: '/personnel/employees' },
          { label: employee.full_name, to: `/personnel/employees/${employeeId}` },
          { label: isEdit ? 'Editar contrato' : 'Nuevo contrato' },
        ]}
      />

      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Editar contrato' : 'Nuevo contrato'}</h1>
        <p className="text-sm text-summa-ink-light mt-1">
          {employee.full_name} — Completa los datos obligatorios (tipo, fechas, salario, cargo, centro de trabajo y seguridad social).
        </p>
      </div>

      {catalogsLoading && (
        <p className="text-sm text-summa-ink-light mb-4">Cargando catálogos…</p>
      )}
      {catalogsEmpty && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-summa p-3 mb-4">
          Faltan datos en catálogos (tipos de contrato, cargos, centros de trabajo, EPS, CCF o tipos de cotizante). En el backend ejecuta{' '}
          <code className="text-xs bg-white px-1 rounded">python manage.py seed_catalogs</code> y crea cargos/centros por tenant si aplica.
        </p>
      )}

      {saveMutation.isError && (
        <ErrorAlert message={errMsg || 'No se pudo guardar el contrato.'} className="mb-4" />
      )}

      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
        <Card>
          <CardHeader title="Datos generales" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Tipo de contrato <span className="text-summa-magenta">*</span>
              </label>
              <select
                {...register('contract_type', { required: 'Requerido' })}
                className="input"
                disabled={!contractTypes.length}
              >
                <option value="">— Seleccionar —</option>
                {contractTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {errors.contract_type && (
                <p className="text-summa-magenta text-xs mt-1">{errors.contract_type.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Tipo de salario</label>
              <select {...register('salary_type')} className="input">
                <option value="">— Opcional —</option>
                {salaryTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Fecha inicio <span className="text-summa-magenta">*</span>
              </label>
              <input type="date" {...register('start_date', { required: 'Requerido' })} className="input" />
              {errors.start_date && <p className="text-summa-magenta text-xs mt-1">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Fecha fin</label>
              <input type="date" {...register('end_date')} className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Salario <span className="text-summa-magenta">*</span>
              </label>
              <input
                {...register('salary', { required: 'Indica el salario' })}
                className="input"
                placeholder="Ej. 2500000"
              />
              {errors.salary && <p className="text-summa-magenta text-xs mt-1">{errors.salary.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Modalidad salario</label>
              <select {...register('salary_mode')} className="input">
                <option value="fixed">Fijo</option>
                <option value="variable">Variable</option>
                <option value="mixed">Mixto</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
              <input type="checkbox" {...register('transport_allowance')} className="rounded border-summa-border" />
              <span className="text-sm font-semibold text-summa-ink">Auxilio de transporte</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
              <input type="checkbox" {...register('is_current')} className="rounded border-summa-border" />
              <span className="text-sm font-semibold text-summa-ink">Marcar como contrato actual</span>
            </label>
          </div>
        </Card>

        <Card>
          <CardHeader title="Cargo y centro de trabajo" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Cargo (posición) <span className="text-summa-magenta">*</span>
              </label>
              <select
                {...register('position', { required: 'Selecciona un cargo' })}
                className="input"
                disabled={!positions.length}
              >
                <option value="">— Seleccionar —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.position && <p className="text-summa-magenta text-xs mt-1">{errors.position.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Centro de trabajo <span className="text-summa-magenta">*</span>
              </label>
              <select
                {...register('work_center', { required: 'Requerido' })}
                className="input"
                disabled={!workCenters.length}
              >
                <option value="">— Seleccionar —</option>
                {workCenters.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {errors.work_center && <p className="text-summa-magenta text-xs mt-1">{errors.work_center.message}</p>}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Seguridad social y cotizante" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                EPS <span className="text-summa-magenta">*</span>
              </label>
              <select {...register('eps', { required: 'Requerido' })} className="input" disabled={!epsList.length}>
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
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Caja de compensación <span className="text-summa-magenta">*</span>
              </label>
              <select {...register('ccf', { required: 'Requerido' })} className="input" disabled={!ccfList.length}>
                <option value="">— Seleccionar —</option>
                {ccfList.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              {errors.ccf && <p className="text-summa-magenta text-xs mt-1">{errors.ccf.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Tipo de cotizante <span className="text-summa-magenta">*</span>
              </label>
              <select
                {...register('contributor_type', { required: 'Requerido' })}
                className="input"
                disabled={!contributorTypes.length}
              >
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
          </div>
        </Card>

        <Card>
          <CardHeader title="Notas" />
          <textarea {...register('notes')} className="input min-h-[80px]" rows={3} placeholder="Observaciones opcionales" />
        </Card>

        <div className="flex gap-3">
          <button type="submit" disabled={saving || catalogsLoading} className="btn-primary">
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear contrato'}
          </button>
          <Link to={`/personnel/employees/${employeeId}`} className="btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
