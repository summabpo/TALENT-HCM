import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hiringApi } from '@/api/hiring'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import type { Candidate } from '@/types'

const CANDIDATE_STATUS: Record<string, { label: string; variant: 'gray' | 'navy' | 'purple' | 'green' | 'magenta' | 'cyan' }> = {
  applied: { label: 'Aplicado', variant: 'gray' },
  screening: { label: 'Selección', variant: 'navy' },
  interview: { label: 'Entrevista', variant: 'cyan' },
  offer: { label: 'Oferta', variant: 'purple' },
  hired: { label: 'Contratado', variant: 'green' },
  rejected: { label: 'Rechazado', variant: 'magenta' },
}

interface HireForm {
  document_type: number
  document_number: number
}

export default function HiringProcessDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useQueryClient()
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [newCandidateName, setNewCandidateName] = useState('')
  const [newCandidateEmail, setNewCandidateEmail] = useState('')
  const [hireTarget, setHireTarget] = useState<Candidate | null>(null)
  const [hireForm, setHireForm] = useState<HireForm>({ document_type: 1, document_number: 0 })

  const { data: process, isLoading: loadingProcess, error: errProcess, refetch } = useQuery({
    queryKey: ['hiring-process', id],
    queryFn: () => hiringApi.process(id!),
    enabled: !!id,
  })

  const { data: candidatesPage, isLoading: loadingCandidates, refetch: refetchCandidates } = useQuery({
    queryKey: ['candidates', id],
    queryFn: () => hiringApi.candidates(id!),
    enabled: !!id,
  })

  const addMutation = useMutation({
    mutationFn: () => hiringApi.createCandidate(id!, {
      full_name: newCandidateName,
      email: newCandidateEmail,
      status: 'applied',
    }),
    onSuccess: () => {
      setShowAddCandidate(false)
      setNewCandidateName('')
      setNewCandidateEmail('')
      refetchCandidates()
    },
  })

  const hireMutation = useMutation({
    mutationFn: () => hiringApi.hireCandidate(id!, hireTarget!.id, hireForm),
    onSuccess: (data: { employee_id?: string }) => {
      setHireTarget(null)
      refetchCandidates()
      if (data?.employee_id) {
        navigate(`/personnel/employees/${data.employee_id}`)
      }
    },
  })

  if (loadingProcess) return <LoadingSpinner />
  if (errProcess || !process) return <ErrorAlert message="No se pudo cargar el proceso." onRetry={refetch} />

  const candidates: Candidate[] = candidatesPage?.results ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Contratación', to: '/hiring' },
        { label: 'Procesos', to: '/hiring/processes' },
        { label: process.position_title },
      ]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">{process.position_title}</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            {process.department_name ?? 'Sin área'} · {process.positions_count} vacante{process.positions_count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              process.status === 'open'
                ? 'green'
                : process.status === 'in_progress'
                  ? 'navy'
                  : process.status === 'filled'
                    ? 'purple'
                    : 'gray'
            }
          >
            {process.status === 'open'
              ? 'Abierto'
              : process.status === 'in_progress'
                ? 'En curso'
                : process.status === 'filled'
                  ? 'Cubierto'
                  : process.status === 'cancelled'
                    ? 'Cancelado'
                    : process.status}
          </Badge>
          <button onClick={() => navigate(`/hiring/processes/${id}/edit`)} className="btn-ghost">
            Editar
          </button>
        </div>
      </div>

      {process.notes && (
        <div className="card p-4">
          <p className="text-sm text-summa-ink">{process.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Candidatos', value: process.candidate_count },
          { label: 'Contratados', value: process.hired_count },
          { label: 'Vacantes', value: process.positions_count },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-summa-ink">{value}</p>
            <p className="text-xs text-summa-ink-light mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-summa-border flex items-center justify-between">
          <h2 className="section-title">Candidatos</h2>
          {(process.status === 'open' || process.status === 'in_progress') && (
            <button onClick={() => setShowAddCandidate(true)} className="btn-secondary btn-sm">
              + Agregar candidato
            </button>
          )}
        </div>

        {showAddCandidate && (
          <div className="px-5 py-4 bg-summa-surface border-b border-summa-border">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                placeholder="Nombre completo *"
                value={newCandidateName}
                onChange={(e) => setNewCandidateName(e.target.value)}
                className="input"
              />
              <input
                type="email"
                placeholder="Correo"
                value={newCandidateEmail}
                onChange={(e) => setNewCandidateEmail(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex gap-2">
              <button
                disabled={!newCandidateName || addMutation.isPending}
                onClick={() => addMutation.mutate()}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                {addMutation.isPending ? 'Agregando...' : 'Agregar'}
              </button>
              <button onClick={() => setShowAddCandidate(false)} className="btn-ghost btn-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loadingCandidates ? (
          <LoadingSpinner />
        ) : candidates.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-summa-ink-light">No hay candidatos aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Etapa</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c: Candidate) => {
                  const s = CANDIDATE_STATUS[c.status] ?? { label: c.status, variant: 'gray' as const }
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/hiring/processes/${id}/candidates/${c.id}`} className="font-semibold text-summa-navy hover:text-summa-magenta transition-colors">
                          {c.full_name}
                        </Link>
                      </td>
                      <td className="text-summa-ink-light">{c.email || '—'}</td>
                      <td><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="text-summa-ink-light">{c.created_at.slice(0, 10)}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/hiring/processes/${id}/candidates/${c.id}`} className="text-xs text-summa-navy hover:text-summa-magenta font-semibold">
                            Ver →
                          </Link>
                          {c.status !== 'hired' && c.status !== 'rejected' && (
                            <button
                              onClick={() => setHireTarget(c)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                            >
                              Contratar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hireTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-summa-ink/40 backdrop-blur-sm" onClick={() => setHireTarget(null)} />
          <div className="relative bg-white rounded-summa-lg shadow-summa-lg p-6 w-full max-w-md mx-4 border-t-4 border-summa-navy">
            <h3 className="font-semibold text-summa-ink mb-1">Contratar candidato</h3>
            <p className="text-sm text-summa-ink-light mb-4">{hireTarget.full_name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-summa-ink block mb-1">Tipo de documento</label>
                <select
                  value={hireForm.document_type}
                  onChange={(e) => setHireForm(f => ({ ...f, document_type: Number(e.target.value) }))}
                  className="input"
                >
                  <option value={1}>Cédula de ciudadanía</option>
                  <option value={2}>Cédula de extranjería</option>
                  <option value={3}>Pasaporte</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-summa-ink block mb-1">Número de documento</label>
                <input
                  type="number"
                  value={hireForm.document_number || ''}
                  onChange={(e) => setHireForm(f => ({ ...f, document_number: Number(e.target.value) }))}
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setHireTarget(null)} className="btn-ghost">Cancelar</button>
              <button
                disabled={!hireForm.document_number || hireMutation.isPending}
                onClick={() => hireMutation.mutate()}
                className="btn-primary disabled:opacity-50"
              >
                {hireMutation.isPending ? 'Procesando...' : 'Confirmar contratación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
