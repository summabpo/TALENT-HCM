import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { qualityApi } from '@/api/quality'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import type { QualityProcess } from '@/types'
import { useState } from 'react'

export default function QualityProcessListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['quality-processes'],
    queryFn: () => qualityApi.processes(),
  })

  const columns = [
    {
      key: 'name',
      header: 'Proceso',
      render: (row: QualityProcess) => (
        <Link to={`/quality/processes/${row.id}`} className="font-semibold text-summa-navy hover:text-summa-magenta transition-colors">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'process_type',
      header: 'Tipo',
      render: (row: QualityProcess) => row.process_type || <span className="text-summa-ink-light">—</span>,
    },
    {
      key: 'owner_name',
      header: 'Responsable',
      render: (row: QualityProcess) => row.owner_name ?? <span className="text-summa-ink-light">—</span>,
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: QualityProcess) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: QualityProcess) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => navigate(`/quality/processes/${row.id}`)} className="btn-ghost btn-sm">Ver</button>
          <button onClick={() => navigate(`/quality/processes/${row.id}/edit`)} className="btn-ghost btn-sm">Editar</button>
        </div>
      ),
    },
  ]

  const results = data?.results ?? []
  const filtered = search
    ? results.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : results

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Calidad', to: '/quality' }, { label: 'Procesos' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Procesos de calidad</h1>
          <p className="text-sm text-summa-ink-light mt-1">Gestión de procesos ISO 9001</p>
        </div>
        <button onClick={() => navigate('/quality/processes/create')} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo proceso
        </button>
      </div>

      <div className="card p-4">
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          loading={isLoading}
          error={error ? 'Error al cargar procesos.' : null}
          onRetry={refetch}
          emptyMessage="No hay procesos registrados."
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar proceso..."
        />
      </div>
    </div>
  )
}
