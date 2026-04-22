import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { qualityApi } from '@/api/quality'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'

type FormData = {
  code: string
  source: string
  description: string
  root_cause: string
  immediate_action: string
  corrective_action: string
  preventive_action: string
  due_date: string
  status: string
}

const EMPTY: FormData = {
  code: '',
  source: '',
  description: '',
  root_cause: '',
  immediate_action: '',
  corrective_action: '',
  preventive_action: '',
  due_date: '',
  status: 'open',
}

const SOURCE_OPTIONS = [
  { value: 'audit', label: 'Auditoría Interna' },
  { value: 'external_audit', label: 'Auditoría Externa' },
  { value: 'customer_complaint', label: 'Queja de Cliente' },
  { value: 'process', label: 'Detección en Proceso' },
  { value: 'employee', label: 'Reporte de Empleado' },
]

const STATUS_OPTIONS = [
  { value: 'open', label: 'Abierta' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'verification', label: 'Verificación' },
  { value: 'closed', label: 'Cerrada' },
]

export default function NonconformityFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const { data: nc, isLoading, error } = useQuery({
    queryKey: ['nonconformity', id],
    queryFn: () => qualityApi.nonconformity(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (nc) {
      reset({
        code: (nc as any).code ?? '',
        source: nc.source ?? '',
        description: nc.description ?? '',
        root_cause: nc.root_cause ?? '',
        immediate_action: nc.immediate_action ?? '',
        corrective_action: nc.corrective_action ?? '',
        preventive_action: nc.preventive_action ?? '',
        due_date: nc.due_date ?? '',
        status: nc.status ?? 'open',
      })
    }
  }, [nc, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        due_date: data.due_date || null,
        status: data.status as 'open' | 'investigating' | 'action_plan' | 'verification' | 'closed',
      }
      return isEdit
        ? qualityApi.updateNonconformity(id!, payload)
        : qualityApi.createNonconformity(payload)
    },
    onSuccess: (result) => {
      navigate(`/quality/nonconformities/${(result as any).id ?? id}`)
    },
    onError: (err) => {
      if (!isAxiosError(err) || err.response?.status !== 400) return
      const data = err.response.data
      if (data && typeof data === 'object') {
        for (const [key, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? val[0] : String(val)
          setError(key as keyof FormData, { message: msg })
        }
      }
    },
  })

  if (isEdit && isLoading) return <LoadingSpinner />
  if (isEdit && error) return <ErrorAlert message="No se pudo cargar la no conformidad." />

  return (
    <div className="animate-fade-in max-w-3xl">
      <Breadcrumb items={[
        { label: 'Calidad', to: '/quality' },
        { label: 'No conformidades', to: '/quality/nonconformities' },
        { label: isEdit ? 'Editar NC' : 'Nueva NC' },
      ]} />

      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Editar No conformidad' : 'Nueva No conformidad'}</h1>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-summa-ink border-b pb-2">Información general</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Código NC*</label>
              <input
                {...register('code', { required: 'El código es requerido' })}
                className="input"
                placeholder="NC-2026-001"
              />
              {errors.code && <p className="form-error">{errors.code.message}</p>}
            </div>

            <div>
              <label className="form-label">Fuente*</label>
              <select {...register('source', { required: 'La fuente es requerida' })} className="input">
                <option value="">— Seleccionar —</option>
                {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.source && <p className="form-error">{errors.source.message}</p>}
            </div>

            <div>
              <label className="form-label">Estado</label>
              <select {...register('status')} className="input">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Fecha límite</label>
              <input type="date" {...register('due_date')} className="input" />
            </div>
          </div>

          <div>
            <label className="form-label">Descripción*</label>
            <textarea
              {...register('description', { required: 'La descripción es requerida' })}
              className="input min-h-[80px]"
              placeholder="Describa la no conformidad detectada..."
            />
            {errors.description && <p className="form-error">{errors.description.message}</p>}
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-summa-ink border-b pb-2">Análisis CAPA</h2>

          <div>
            <label className="form-label">Causa raíz</label>
            <textarea {...register('root_cause')} className="input min-h-[70px]" placeholder="Análisis de causa raíz..." />
          </div>

          <div>
            <label className="form-label">Acción inmediata</label>
            <textarea {...register('immediate_action')} className="input min-h-[70px]" placeholder="Acción inmediata tomada..." />
          </div>

          <div>
            <label className="form-label">Acción correctiva</label>
            <textarea {...register('corrective_action')} className="input min-h-[70px]" placeholder="Plan de acción correctiva..." />
          </div>

          <div>
            <label className="form-label">Acción preventiva</label>
            <textarea {...register('preventive_action')} className="input min-h-[70px]" placeholder="Medidas preventivas..." />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
            {isSubmitting || mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => navigate('/quality/nonconformities')} className="btn-ghost">
            Cancelar
          </button>
        </div>

        {mutation.isError && !isAxiosError(mutation.error) && (
          <p className="text-red-600 text-sm">Error al guardar. Intenta de nuevo.</p>
        )}
      </form>
    </div>
  )
}
