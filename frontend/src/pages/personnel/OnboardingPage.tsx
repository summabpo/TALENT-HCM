import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { personnelApi } from '@/api/personnel'
import { hiringApi } from '@/api/hiring'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import ProgressBar from '@/components/ui/ProgressBar'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import type { OnboardingTaskCompletion } from '@/types'

const STATUS_MAP: Record<string, { label: string; variant: 'green' | 'cyan' | 'gray' }> = {
  completed: { label: 'Completado', variant: 'green' },
  in_progress: { label: 'En progreso', variant: 'cyan' },
  pending: { label: 'Pendiente', variant: 'gray' },
}

export default function OnboardingPage() {
  const { id: employeeId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [completingTask, setCompletingTask] = useState<{ onboardingId: string; taskId: string } | null>(null)
  const [completedBy, setCompletedBy] = useState('')
  const [notes, setNotes] = useState('')

  const { data: employee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => personnelApi.employee(employeeId!),
    enabled: !!employeeId,
  })

  const { data: onboardings, isLoading, error, refetch } = useQuery({
    queryKey: ['onboarding', employeeId],
    queryFn: () => hiringApi.onboarding(employeeId!),
    enabled: !!employeeId,
  })

  const completeMutation = useMutation({
    mutationFn: ({ onboardingId, taskId }: { onboardingId: string; taskId: string }) =>
      hiringApi.completeTask(employeeId!, onboardingId, taskId, { completed_by: completedBy, notes }),
    onSuccess: () => {
      setCompletingTask(null)
      setCompletedBy('')
      setNotes('')
      qc.invalidateQueries({ queryKey: ['onboarding', employeeId] })
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert message="Error al cargar el onboarding." onRetry={refetch} />

  const onboarding = onboardings?.[0]

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Personal', to: '/personnel' },
        { label: 'Empleados', to: '/personnel/employees' },
        { label: employee?.full_name ?? '…', to: `/personnel/employees/${employeeId}` },
        { label: 'Onboarding' },
      ]} />

      <div className="page-header">
        <h1 className="page-title">Onboarding</h1>
      </div>

      {!onboarding ? (
        <div className="card p-12 text-center text-sm text-summa-ink-light">
          No hay proceso de onboarding activo para este empleado.
        </div>
      ) : (
        <>
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-summa-ink">{onboarding.checklist_name}</h2>
                <p className="text-sm text-summa-ink-light mt-0.5">Inicio: {onboarding.start_date}</p>
              </div>
              <Badge variant={STATUS_MAP[onboarding.status]?.variant ?? 'gray'}>
                {STATUS_MAP[onboarding.status]?.label ?? onboarding.status}
              </Badge>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-summa-ink">Progreso general</span>
                <span className="text-sm font-bold text-summa-navy">{onboarding.progress_percentage}%</span>
              </div>
              <ProgressBar value={onboarding.progress_percentage} showLabel={false} />
            </div>
          </Card>

          <Card padding={false}>
            <CardHeader title="Tareas" className="px-6 pt-6 pb-0" />
            <ul className="divide-y divide-summa-border">
              {onboarding.completions.map((completion: OnboardingTaskCompletion) => (
                <li key={completion.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                      completion.is_complete
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-summa-border'
                    }`}>
                      {completion.is_complete && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${completion.is_complete ? 'text-summa-ink-light line-through' : 'text-summa-ink'}`}>
                        {completion.task_title}
                      </p>
                      <div className="flex gap-3 mt-1 text-xs text-summa-ink-light">
                        <span>Rol: {completion.responsible_role}</span>
                        <span>Plazo: {completion.days_to_complete}d</span>
                        {completion.completed_by && <span>Por: {completion.completed_by}</span>}
                        {completion.completed_at && <span>{completion.completed_at.slice(0, 10)}</span>}
                      </div>
                    </div>
                  </div>
                  {!completion.is_complete && (
                    <button
                      onClick={() => setCompletingTask({ onboardingId: onboarding.id, taskId: completion.task })}
                      className="flex-shrink-0 btn-secondary btn-sm"
                    >
                      Completar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-summa-ink/40 backdrop-blur-sm" onClick={() => setCompletingTask(null)} />
          <div className="relative bg-white rounded-summa-lg shadow-summa-lg p-6 w-full max-w-md mx-4 border-t-4 border-summa-navy">
            <h3 className="font-semibold text-summa-ink mb-4">Completar tarea</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-summa-ink block mb-1">Completado por *</label>
                <input
                  value={completedBy}
                  onChange={(e) => setCompletedBy(e.target.value)}
                  className="input"
                  placeholder="Nombre o correo"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-summa-ink block mb-1">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="input resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setCompletingTask(null)} className="btn-ghost">Cancelar</button>
              <button
                disabled={!completedBy || completeMutation.isPending}
                onClick={() => completeMutation.mutate(completingTask)}
                className="btn-primary disabled:opacity-50"
              >
                {completeMutation.isPending ? 'Guardando...' : 'Marcar completada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
