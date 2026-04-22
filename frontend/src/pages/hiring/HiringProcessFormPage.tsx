import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hiringApi } from '@/api/hiring'
import { personnelApi } from '@/api/personnel'
import { useAuth } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { HiringProcess } from '@/types'

type FormValues = {
  position_title: string
  department_id: string
  requested_by: string
  status: HiringProcess['status']
  positions_count: number
  notes: string
}

const STATUS_OPTIONS: { value: HiringProcess['status']; label: string }[] = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'filled', label: 'Cubierto' },
  { value: 'cancelled', label: 'Cancelado' },
]

export default function HiringProcessFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const { data: process, isLoading: loadingProcess, error: errProcess, refetch } = useQuery({
    queryKey: ['hiring-process', id],
    queryFn: () => hiringApi.process(id!),
    enabled: isEdit,
  })

  const { data: deptPage } = useQuery({
    queryKey: ['departments'],
    queryFn: () => personnelApi.departments(),
  })
  const departments = deptPage?.results ?? []

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      position_title: '',
      department_id: '',
      requested_by: '',
      status: 'open',
      positions_count: 1,
      notes: '',
    },
  })

  useEffect(() => {
    if (!process) return
    reset({
      position_title: process.position_title,
      department_id: process.department ?? '',
      requested_by: process.requested_by,
      status: process.status,
      positions_count: process.positions_count,
      notes: process.notes ?? '',
    })
  }, [process, reset])

  const saveMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        position_title: data.position_title.trim(),
        department: data.department_id || null,
        requested_by: data.requested_by.trim(),
        status: data.status,
        positions_count: Math.max(1, Number(data.positions_count) || 1),
        notes: data.notes.trim(),
      }
      return isEdit ? hiringApi.updateProcess(id!, payload) : hiringApi.createProcess(payload)
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['hiring-processes'] })
      qc.invalidateQueries({ queryKey: ['hiring-process', saved.id] })
      navigate(`/hiring/processes/${saved.id}`)
    },
  })

  if (isEdit && loadingProcess) return <LoadingSpinner />
  if (isEdit && (errProcess || !process)) {
    return <ErrorAlert message="No se pudo cargar el proceso." onRetry={refetch} />
  }

  if (!user) return null

  return (
    <div className="animate-fade-in max-w-2xl">
      <Breadcrumb
        items={[
          { label: 'Contratación', to: '/hiring' },
          { label: 'Procesos', to: '/hiring/processes' },
          { label: isEdit ? (process?.position_title ?? 'Editar') : 'Nuevo proceso' },
        ]}
      />

      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Editar proceso' : 'Nuevo proceso de contratación'}</h1>
        <p className="text-sm text-summa-ink-light mt-1">
          Define el cargo, el área y quién solicita la vacante. Luego podrás agregar candidatos en el detalle del proceso.
        </p>
      </div>

      {saveMutation.error && (
        <ErrorAlert
          message="No se pudo guardar. Revisa los campos obligatorios."
          className="mb-4"
        />
      )}

      <form
        onSubmit={handleSubmit((data) => saveMutation.mutate(data))}
        className="card p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-semibold text-summa-ink mb-1">
            Cargo / puesto <span className="text-summa-magenta">*</span>
          </label>
          <input
            {...register('position_title', { required: 'Indica el nombre del cargo' })}
            className="input"
            placeholder="Ej. Desarrollador backend senior"
          />
          {errors.position_title && (
            <p className="text-summa-magenta text-xs mt-1">{errors.position_title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-summa-ink mb-1">Área / departamento</label>
          <select {...register('department_id')} className="input">
            <option value="">— Sin asignar —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-summa-ink mb-1">
            Solicitado por <span className="text-summa-magenta">*</span>
          </label>
          <input
            {...register('requested_by', { required: 'Indica quién solicita la vacante' })}
            className="input"
            placeholder="Nombre del responsable o área"
          />
          {errors.requested_by && (
            <p className="text-summa-magenta text-xs mt-1">{errors.requested_by.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-summa-ink mb-1">Estado</label>
            <select {...register('status')} className="input">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-summa-ink mb-1">Número de vacantes</label>
            <input
              type="number"
              min={1}
              {...register('positions_count', { valueAsNumber: true, min: 1 })}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-summa-ink mb-1">Notas</label>
          <textarea {...register('notes')} className="input min-h-[100px]" rows={4} placeholder="Requisitos, observaciones…" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isSubmitting || saveMutation.isPending} className="btn-primary">
            {saveMutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear proceso'}
          </button>
          <Link to={isEdit ? `/hiring/processes/${id}` : '/hiring/processes'} className="btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>

      {!isEdit && (
        <p className="text-xs text-summa-ink-light mt-4">
          El empleado que registraste en Personal no se vincula automáticamente aquí: los procesos son vacantes. Agrega
          candidatos (o la misma persona como candidato) una vez creado el proceso.
        </p>
      )}
    </div>
  )
}
