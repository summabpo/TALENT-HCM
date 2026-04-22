import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsApi } from '@/api/tenants'
import { useAuth } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { TenantAdmin } from '@/types'

export default function TenantListPage() {
  const { user } = useAuth()
  const isPlatformAdmin = Boolean(user?.is_superuser)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenants', page, search],
    queryFn: () => tenantsApi.list({ page: String(page), ...(search ? { search } : {}) }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.delete(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  if (!user?.is_staff) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-summa-magenta/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-summa-magenta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-summa-ink">Acceso restringido</h2>
        <p className="text-sm text-summa-ink-light">Solo los administradores pueden acceder a esta sección.</p>
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      header: 'Nombre empresa',
      render: (row: TenantAdmin) => (
        <Link to={`/admin/tenants/${row.id}/edit`} className="font-semibold text-summa-navy hover:text-summa-magenta transition-colors">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (row: TenantAdmin) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.slug}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Activo',
      render: (row: TenantAdmin) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'module_count',
      header: 'Módulos',
      render: (row: TenantAdmin) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <span className="font-semibold text-summa-navy">{row.module_count ?? '—'}</span>
          <span className="text-summa-ink-light">activos</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Creado',
      render: (row: TenantAdmin) => (
        <span className="text-summa-ink-light text-xs">{row.created_at.slice(0, 10)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: TenantAdmin) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => navigate(`/admin/tenants/${row.id}/edit`)} className="btn-ghost btn-sm">
            Editar
          </button>
          <button onClick={() => navigate(`/admin/tenants/${row.id}/modules`)} className="btn-secondary btn-sm">
            Módulos
          </button>
          {isPlatformAdmin && (
            <button
              onClick={() => setDeleteId(row.id)}
              className="btn-sm inline-flex items-center text-summa-magenta border border-summa-magenta/30 hover:bg-summa-magenta hover:text-white rounded-summa px-3 py-1.5 text-xs font-semibold transition-all"
            >
              Eliminar
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Admin', to: '/admin' }, { label: 'Empresas' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Empresas (Tenants)</h1>
          <p className="text-sm text-summa-ink-light mt-1">Gestión de clientes y configuración multi-tenant</p>
        </div>
        {isPlatformAdmin && (
          <Link to="/admin/tenants/create" className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Tenant
          </Link>
        )}
      </div>

      {error && <ErrorAlert message="Error al cargar los tenants." onRetry={refetch} className="mb-4" />}

      <div className="card p-4">
        <DataTable
          columns={columns}
          data={data?.results ?? []}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay tenants registrados."
          page={page}
          pageSize={20}
          total={data?.count}
          onPageChange={(p) => setPage(p)}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar por nombre..."
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar tenant"
        message="¿Eliminar este tenant? Esta acción eliminará toda la configuración asociada y no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
