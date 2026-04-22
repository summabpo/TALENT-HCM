import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { performanceApi } from '@/api/performance'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import type { KPI } from '@/types'
import { useState } from 'react'

const FREQ_LABELS: Record<string, string> = {
  daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual',
  quarterly: 'Trimestral', annual: 'Anual',
}

export default function KPIListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => performanceApi.kpis({ all: 'true' }),
  })

  const columns = [
    {
      key: 'name',
      header: 'Indicador',
      render: (row: KPI) => (
        <Link to={`/performance/kpis/${row.id}/dashboard`} className="font-semibold text-summa-navy hover:text-summa-magenta transition-colors">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'metric_type',
      header: 'Métrica',
      render: (row: KPI) => <span className="text-summa-ink">{row.metric_type}</span>,
    },
    {
      key: 'target_value',
      header: 'Meta',
      render: (row: KPI) => <span className="tabular-nums font-semibold text-summa-ink">{Number(row.target_value).toLocaleString('es-CO')}</span>,
    },
    {
      key: 'frequency',
      header: 'Frecuencia',
      render: (row: KPI) => <span className="text-summa-ink-light">{FREQ_LABELS[row.frequency] ?? row.frequency}</span>,
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: KPI) => <Badge variant={row.is_active ? 'green' : 'gray'}>{row.is_active ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: KPI) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => navigate(`/performance/kpis/${row.id}/dashboard`)} className="btn-ghost btn-sm">Dashboard</button>
          <button onClick={() => navigate(`/performance/kpis/${row.id}/edit`)} className="btn-ghost btn-sm">Editar</button>
        </div>
      ),
    },
  ]

  const results = data?.results ?? []
  const filtered = search ? results.filter(k => k.name.toLowerCase().includes(search.toLowerCase())) : results

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Desempeño', to: '/performance' }, { label: 'KPIs' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">KPIs</h1>
          <p className="text-sm text-summa-ink-light mt-1">Indicadores clave de desempeño</p>
        </div>
        <button onClick={() => navigate('/performance/kpis/create')} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo KPI
        </button>
      </div>

      <div className="card p-4">
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          loading={isLoading}
          error={error ? 'Error al cargar KPIs.' : null}
          onRetry={refetch}
          emptyMessage="No hay KPIs registrados."
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar KPI..."
        />
      </div>
    </div>
  )
}
