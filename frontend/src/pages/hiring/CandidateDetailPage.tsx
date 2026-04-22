import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hiringApi } from '@/api/hiring'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useState } from 'react'

const STAGES = [
  { value: 'applied', label: 'Aplicado' },
  { value: 'screening', label: 'Selección' },
  { value: 'interview', label: 'Entrevista' },
  { value: 'offer', label: 'Oferta' },
  { value: 'hired', label: 'Contratado' },
  { value: 'rejected', label: 'Rechazado' },
]

const STATUS_VARIANT: Record<string, 'gray' | 'navy' | 'cyan' | 'green' | 'magenta' | 'purple'> = {
  applied: 'gray', screening: 'navy', interview: 'cyan',
  offer: 'purple', hired: 'green', rejected: 'magenta',
}

export default function CandidateDetailPage() {
  const { processId, id: candidateId } = useParams<{ processId: string; id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [showReject, setShowReject] = useState(false)

  const { data: candidate, isLoading, error, refetch } = useQuery({
    queryKey: ['candidate', processId, candidateId],
    queryFn: () => hiringApi.candidate(processId!, candidateId!),
    enabled: !!processId && !!candidateId,
    select: (data) => { setNotes(data.notes); return data },
  })

  const { data: process } = useQuery({
    queryKey: ['hiring-process', processId],
    queryFn: () => hiringApi.process(processId!),
    enabled: !!processId,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<import('@/types').Candidate>) =>
      hiringApi.updateCandidate(processId!, candidateId!, data),
    onSuccess: () => {
      setEditingNotes(false)
      qc.invalidateQueries({ queryKey: ['candidate', processId, candidateId] })
      qc.invalidateQueries({ queryKey: ['candidates', processId] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => hiringApi.updateCandidate(processId!, candidateId!, { status: 'rejected' }),
    onSuccess: () => {
      setShowReject(false)
      qc.invalidateQueries({ queryKey: ['candidate', processId, candidateId] })
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error || !candidate) return <ErrorAlert message="No se pudo cargar el candidato." onRetry={refetch} />

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Contratación', to: '/hiring' },
        { label: 'Procesos', to: '/hiring/processes' },
        { label: process?.position_title ?? '…', to: `/hiring/processes/${processId}` },
        { label: candidate.full_name },
      ]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">{candidate.full_name}</h1>
          <p className="text-sm text-summa-ink-light mt-1">{candidate.email || '—'} · {candidate.phone || '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          {candidate.status !== 'hired' && candidate.status !== 'rejected' && (
            <button onClick={() => setShowReject(true)} className="btn-danger">
              Rechazar
            </button>
          )}
          {candidate.employee_id && (
            <button
              onClick={() => navigate(`/personnel/employees/${candidate.employee_id}`)}
              className="btn-secondary"
            >
              Ver empleado
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Información del candidato" />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">Correo</dt>
                <dd className="mt-0.5 text-summa-ink">{candidate.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">Teléfono</dt>
                <dd className="mt-0.5 text-summa-ink">{candidate.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">Proceso</dt>
                <dd className="mt-0.5 text-summa-ink">{candidate.hiring_process_title}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">Fecha aplicación</dt>
                <dd className="mt-0.5 text-summa-ink">{candidate.created_at.slice(0, 10)}</dd>
              </div>
              {candidate.resume && (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">Hoja de vida</dt>
                  <dd className="mt-0.5">
                    <a href={candidate.resume} target="_blank" rel="noreferrer" className="text-summa-navy hover:text-summa-magenta text-sm font-semibold transition-colors">
                      Descargar CV →
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Notas"
              action={
                !editingNotes ? (
                  <button onClick={() => setEditingNotes(true)} className="text-xs text-summa-navy hover:text-summa-magenta font-semibold">
                    Editar
                  </button>
                ) : null
              }
            />
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="input resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateMutation.mutate({ notes } as Partial<import('@/types').Candidate>)}
                    disabled={updateMutation.isPending}
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button onClick={() => setEditingNotes(false)} className="btn-ghost btn-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-summa-ink whitespace-pre-wrap">{candidate.notes || 'Sin notas.'}</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Etapa actual" />
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={STATUS_VARIANT[candidate.status] ?? 'gray'}>
                {STAGES.find(s => s.value === candidate.status)?.label ?? candidate.status}
              </Badge>
            </div>
            {candidate.status !== 'hired' && candidate.status !== 'rejected' && (
              <div>
                <label className="text-xs font-semibold text-summa-ink-light block mb-1">Cambiar etapa</label>
                <select
                  value={candidate.status}
                  onChange={(e) => updateMutation.mutate({ status: e.target.value as import('@/types').Candidate['status'] })}
                  className="input"
                >
                  {STAGES.filter(s => s.value !== 'hired' && s.value !== 'rejected').map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showReject}
        title="Rechazar candidato"
        message={`¿Rechazar a ${candidate.full_name}? Esta acción cambiará su estado a "Rechazado".`}
        confirmLabel="Rechazar"
        danger
        loading={rejectMutation.isPending}
        onConfirm={() => rejectMutation.mutate()}
        onCancel={() => setShowReject(false)}
      />
    </div>
  )
}
