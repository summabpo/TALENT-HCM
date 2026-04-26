import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { nomiwebConfigApi } from '@/api/integrations'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import SyncStatusBadge from '@/components/integrations/SyncStatusBadge'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { NomiwebConfig } from '@/types'

export default function IntegrationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nomiweb-configs', page],
    queryFn: () => nomiwebConfigApi.list({ page: String(page) }),
  })

  async function handleSyncNow(config: NomiwebConfig) {
    setSyncingId(config.id)
    setSyncError(null)
    try {
      await nomiwebConfigApi.syncNow(config.id)
      qc.invalidateQueries({ queryKey: ['nomiweb-configs'] })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar'
      setSyncError(`${config.tenant_name}: ${msg}`)
    } finally {
      setSyncingId(null)
    }
  }

  if (!user?.is_staff) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-lg font-bold text-summa-ink">Acceso restringido</h2>
        <p className="text-sm text-summa-ink-light">Solo los administradores pueden gestionar integraciones.</p>
      </div>
    )
  }

  const columns = [
    {
      key: 'tenant_name',
      header: 'Empresa',
      render: (row: NomiwebConfig) => (
        <button
          type="button"
          onClick={() => navigate(`/admin/integrations/${row.id}`)}
          className="font-semibold text-summa-navy hover:text-summa-magenta transition-colors text-left"
        >
          {row.tenant_name}
        </button>
      ),
    },
    {
      key: 'nomiweb_empresa_id',
      header: 'ID Nomiweb',
      render: (row: NomiwebConfig) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.nomiweb_empresa_id}</span>
      ),
    },
    {
      key: 'sync_enabled',
      header: 'Activo',
      render: (row: NomiwebConfig) => (
        <Badge variant={row.sync_enabled ? 'green' : 'gray'}>
          {row.sync_enabled ? 'Habilitado' : 'Deshabilitado'}
        </Badge>
      ),
    },
    {
      key: 'last_sync_status',
      header: 'Estado sync',
      render: (row: NomiwebConfig) => <SyncStatusBadge status={row.last_sync_status} />,
    },
    {
      key: 'last_sync_at_display',
      header: 'Última sync',
      render: (row: NomiwebConfig) => (
        <span className="text-xs text-summa-ink-light">
          {row.last_sync_at_display ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: NomiwebConfig) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => navigate(`/admin/integrations/${row.id}`)}
            className="btn-ghost btn-sm"
          >
            Configurar
          </button>
          <button
            type="button"
            onClick={() => handleSyncNow(row)}
            disabled={syncingId === row.id}
            className="btn-sm inline-flex items-center rounded-summa px-3 py-1.5 text-xs font-semibold border text-summa-navy border-summa-border hover:bg-summa-navy hover:text-white hover:border-summa-navy transition-all disabled:opacity-50"
          >
            {syncingId === row.id ? 'Sincronizando…' : 'Sync ahora'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <Breadcrumb
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Integraciones' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Integración Nomiweb</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Configuración de sincronización con Nomiweb por empresa
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/integrations/create')}
          className="btn-primary"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva configuración
        </button>
      </div>

      {error && (
        <ErrorAlert message="Error al cargar las configuraciones." error={error} onRetry={refetch} className="mb-4" />
      )}
      {syncError && (
        <div className="mb-4 p-3 rounded-summa bg-red-50 border border-red-200 text-sm text-red-700">
          {syncError}
        </div>
      )}

      <div className="card p-4">
        <DataTable
          columns={columns}
          data={data?.results ?? []}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay configuraciones registradas."
          page={page}
          pageSize={50}
          total={data?.count}
          onPageChange={(p) => setPage(p)}
        />
      </div>
    </div>
  )
}
