import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { personnelApi } from '@/api/personnel'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { EmployeeList } from '@/types'

const STATUS_MAP: Record<string, { label: string; variant: 'green' | 'gray' | 'magenta' | 'purple' }> = {
  active:     { label: 'Activo',     variant: 'green'   },
  inactive:   { label: 'Inactivo',   variant: 'gray'    },
  on_leave:   { label: 'En licencia o ausencia', variant: 'purple' },
  terminated: { label: 'Retirado',   variant: 'magenta' },
}

export default function EmployeeListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () => personnelApi.employees({ page: String(page), search }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personnelApi.deleteEmployee(id),
    onSuccess: () => { setDeleteId(null); qc.invalidateQueries({ queryKey: ['employees'] }) },
  })

  const columns = [
    {
      key: 'full_name', header: 'Nombre',
      render: (row: EmployeeList) => (
        <Link to={`/personnel/employees/${row.id}`} className="font-semibold text-summa-navy hover:text-summa-magenta transition-colors">
          {row.full_name}
        </Link>
      ),
    },
    {
      key: 'document', header: 'Documento',
      render: (row: EmployeeList) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.document_type_code} {row.document_number}</span>
      ),
    },
    {
      key: 'department_name', header: 'Área',
      render: (row: EmployeeList) => row.department_name ?? <span className="text-summa-ink-light">—</span>,
    },
    {
      key: 'employee_number', header: 'N° Empleado',
      render: (row: EmployeeList) => row.employee_number || <span className="text-summa-ink-light">—</span>,
    },
    {
      key: 'status', header: 'Estado',
      render: (row: EmployeeList) => {
        const s = STATUS_MAP[row.status] ?? { label: row.status, variant: 'gray' as const }
        return <Badge variant={s.variant}>{s.label}</Badge>
      },
    },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (row: EmployeeList) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => navigate(`/personnel/employees/${row.id}`)} className="btn-ghost btn-sm">Ver</button>
          <button onClick={() => navigate(`/personnel/employees/${row.id}/edit`)} className="btn-ghost btn-sm">Editar</button>
          <button
            onClick={() => navigate(`/personnel/employees/${row.id}#contracts`)}
            className="btn-ghost btn-sm"
          >
            Contratos
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="btn-sm inline-flex items-center text-summa-magenta border border-summa-magenta/30 hover:bg-summa-magenta hover:text-white rounded-summa px-3 py-1.5 text-xs font-semibold transition-all"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Personal', to: '/personnel' }, { label: 'Empleados' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Empleados</h1>
          <p className="text-sm text-summa-ink-light mt-1">Gestión de personal activo e histórico</p>
        </div>
        <Link to="/personnel/employees/create" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo empleado
        </Link>
      </div>

      <div className="card p-4">
        <DataTable
          columns={columns}
          data={data?.results ?? []}
          keyField="id"
          loading={isLoading}
          error={error ? 'Error al cargar empleados.' : null}
          onRetry={refetch}
          emptyMessage="No hay empleados registrados."
          page={page} pageSize={20} total={data?.count}
          onPageChange={(p) => setPage(p)}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar por nombre o documento..."
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar empleado"
        message="¿Estás seguro de que deseas eliminar este empleado? Esta acción no se puede deshacer."
        confirmLabel="Eliminar" danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
