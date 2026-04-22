import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { performanceApi } from '@/api/performance'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { OKRPeriod } from '@/types'

export default function OKRPeriodListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [closeId, setCloseId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['okr-periods'],
    queryFn: () => performanceApi.periods(),
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => performanceApi.updatePeriod(id, { is_active: false }),
    onSuccess: () => { setCloseId(null); qc.invalidateQueries({ queryKey: ['okr-periods'] }) },
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert message="Error al cargar los periodos." onRetry={refetch} />

  const periods: OKRPeriod[] = data?.results ?? []

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Desempeño', to: '/performance' }, { label: 'Periodos OKR' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Periodos OKR</h1>
          <p className="text-sm text-summa-ink-light mt-1">Gestión de objetivos y resultados clave</p>
        </div>
        <button onClick={() => navigate('/performance/periods/create')} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo periodo
        </button>
      </div>

      {periods.length === 0 ? (
        <div className="card p-12 text-center text-sm text-summa-ink-light">
          No hay periodos registrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {periods.map((period: OKRPeriod) => (
            <div
              key={period.id}
              className={`card p-5 flex flex-col gap-3 hover:shadow-summa-md transition-shadow ${
                period.is_active ? 'ring-2 ring-summa-navy' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-summa-ink">{period.name}</h3>
                {period.is_active && <Badge variant="navy">Activo</Badge>}
              </div>
              <p className="text-xs text-summa-ink-light">
                {period.start_date} → {period.end_date}
              </p>
              <div className="flex gap-2 pt-2 border-t border-summa-border">
                <Link
                  to={`/performance/periods/${period.id}/dashboard`}
                  className="flex-1 text-center btn-secondary btn-sm"
                >
                  Ver OKRs
                </Link>
                <button
                  onClick={() => navigate(`/performance/periods/${period.id}/edit`)}
                  className="btn-ghost btn-sm"
                >
                  Editar
                </button>
                {period.is_active && (
                  <button
                    onClick={() => setCloseId(period.id)}
                    className="btn-sm inline-flex items-center text-summa-purple border border-summa-purple/30 hover:bg-summa-purple hover:text-white rounded-summa px-3 py-1.5 text-xs font-semibold transition-all"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!closeId}
        title="Cerrar periodo"
        message="¿Marcar este periodo como inactivo?"
        confirmLabel="Cerrar"
        loading={closeMutation.isPending}
        onConfirm={() => closeId && closeMutation.mutate(closeId)}
        onCancel={() => setCloseId(null)}
      />
    </div>
  )
}
