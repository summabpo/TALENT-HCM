import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { qualityApi } from '@/api/quality'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import type { NonConformity } from '@/types'

const STATUS_MAP: Record<string, { label: string; variant: 'magenta' | 'purple' | 'navy' | 'cyan' | 'green' | 'gray' }> = {
  open: { label: 'Abierta', variant: 'magenta' },
  investigating: { label: 'Investigando', variant: 'purple' },
  action_plan: { label: 'Plan acción', variant: 'navy' },
  verification: { label: 'Verificación', variant: 'cyan' },
  closed: { label: 'Cerrada', variant: 'green' },
}

const SEVERITY_MAP: Record<string, { label: string; variant: 'magenta' | 'purple' | 'navy' }> = {
  critical: { label: 'Crítica', variant: 'magenta' },
  major: { label: 'Mayor', variant: 'purple' },
  minor: { label: 'Menor', variant: 'navy' },
}

export default function NonconformityListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nonconformities', statusFilter, severityFilter],
    queryFn: () => qualityApi.nonconformities({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(severityFilter ? { severity: severityFilter } : {}),
    }),
  })

  const columns = [
    {
      key: 'title',
      header: 'Título',
      render: (row: NonConformity) => (
        <Link to={`/quality/nonconformities/${row.id}`} className="font-semibold text-summa-navy hover:text-summa-magenta transition-colors">
          {row.title}
        </Link>
      ),
    },
    {
      key: 'source',
      header: 'Fuente',
      render: (row: NonConformity) => row.source || <span className="text-summa-ink-light">—</span>,
    },
    {
      key: 'severity',
      header: 'Severidad',
      render: (row: NonConformity) => {
        const s = SEVERITY_MAP[row.severity] ?? { label: row.severity, variant: 'navy' as const }
        return <Badge variant={s.variant}>{s.label}</Badge>
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row: NonConformity) => {
        const s = STATUS_MAP[row.status] ?? { label: row.status, variant: 'gray' as const }
        return <Badge variant={s.variant}>{s.label}</Badge>
      },
    },
    {
      key: 'owner_name',
      header: 'Responsable',
      render: (row: NonConformity) => row.owner_name ?? <span className="text-summa-ink-light">—</span>,
    },
    {
      key: 'detected_date',
      header: 'Detectada',
      render: (row: NonConformity) => <span className="text-summa-ink-light">{row.detected_date}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: NonConformity) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => navigate(`/quality/nonconformities/${row.id}`)} className="btn-ghost btn-sm">Ver</button>
          <button onClick={() => navigate(`/quality/nonconformities/${row.id}/edit`)} className="btn-ghost btn-sm">Editar</button>
        </div>
      ),
    },
  ]

  const results = data?.results ?? []
  const filtered = search ? results.filter(r => r.title.toLowerCase().includes(search.toLowerCase())) : results

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Calidad', to: '/quality' }, { label: 'No conformidades' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">No conformidades</h1>
          <p className="text-sm text-summa-ink-light mt-1">Registro y seguimiento de NC</p>
        </div>
        <button onClick={() => navigate('/quality/nonconformities/create')} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva NC
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="input max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">Todas las severidades</option>
          {Object.entries(SEVERITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="card p-4">
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          loading={isLoading}
          error={error ? 'Error al cargar no conformidades.' : null}
          onRetry={refetch}
          emptyMessage="No hay no conformidades registradas."
        />
      </div>
    </div>
  )
}
