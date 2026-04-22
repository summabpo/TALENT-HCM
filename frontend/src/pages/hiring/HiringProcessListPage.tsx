import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hiringApi } from '@/api/hiring'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { HiringProcess } from '@/types'

const STATUS_MAP: Record<string, { label: string; variant: 'green' | 'purple' | 'gray' | 'navy' }> = {
  open: { label: 'Abierto', variant: 'green' },
  in_progress: { label: 'En curso', variant: 'navy' },
  filled: { label: 'Cubierto', variant: 'purple' },
  cancelled: { label: 'Cancelado', variant: 'gray' },
}

export default function HiringProcessListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [closeId, setCloseId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hiring-processes', search],
    queryFn: () => hiringApi.processes(search ? { search } : undefined),
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => hiringApi.updateProcess(id, { status: 'cancelled' }),
    onSuccess: () => {
      setCloseId(null)
      qc.invalidateQueries({ queryKey: ['hiring-processes'] })
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert message="Error al cargar los procesos." onRetry={refetch} />

  const processes = data?.results ?? []
  const filtered = search
    ? processes.filter(p => p.position_title.toLowerCase().includes(search.toLowerCase()))
    : processes

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Contratación', to: '/hiring' }, { label: 'Procesos' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Procesos de contratación</h1>
          <p className="text-sm text-summa-ink-light mt-1">Gestión de vacantes y candidatos</p>
        </div>
        <button onClick={() => navigate('/hiring/processes/create')} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo proceso
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cargo..."
          className="input max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-sm text-summa-ink-light">
          No hay procesos registrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((process: HiringProcess) => {
            const s = STATUS_MAP[process.status] ?? { label: process.status, variant: 'gray' as const }
            return (
              <div key={process.id} className="card p-5 flex flex-col gap-3 hover:shadow-summa-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-summa-ink text-sm leading-tight">{process.position_title}</h3>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>

                {process.department_name && (
                  <p className="text-xs text-summa-ink-light">{process.department_name}</p>
                )}

                <div className="flex gap-4 text-xs text-summa-ink">
                  <span><span className="font-semibold">{process.candidate_count}</span> candidatos</span>
                  <span><span className="font-semibold">{process.hired_count}</span> contratados</span>
                  <span><span className="font-semibold">{process.positions_count}</span> vacantes</span>
                </div>

                <div className="flex gap-2 mt-auto pt-2 border-t border-summa-border">
                  <Link
                    to={`/hiring/processes/${process.id}`}
                    className="flex-1 text-center btn-secondary btn-sm"
                  >
                    Ver detalle
                  </Link>
                  <button
                    onClick={() => navigate(`/hiring/processes/${process.id}/edit`)}
                    className="btn-ghost btn-sm"
                  >
                    Editar
                  </button>
                  {(process.status === 'open' || process.status === 'in_progress') && (
                    <button
                      onClick={() => setCloseId(process.id)}
                      className="btn-sm inline-flex items-center text-summa-purple border border-summa-purple/30 hover:bg-summa-purple hover:text-white rounded-summa px-3 py-1.5 text-xs font-semibold transition-all"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!closeId}
        title="Cerrar proceso"
        message="¿Cerrar este proceso de contratación? Ya no se podrán agregar candidatos."
        confirmLabel="Cerrar proceso"
        loading={closeMutation.isPending}
        onConfirm={() => closeId && closeMutation.mutate(closeId)}
        onCancel={() => setCloseId(null)}
      />
    </div>
  )
}
