import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { syncLogApi, nomiwebConfigApi } from '@/api/integrations'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { SyncLog } from '@/types'

const MODEL_OPTIONS = [
  { value: '', label: 'Todos los modelos' },
  { value: 'tenant', label: 'Empresa' },
  { value: 'position', label: 'Cargo' },
  { value: 'cost_center', label: 'Centro costo' },
  { value: 'work_location', label: 'Sede' },
  { value: 'work_center', label: 'Centro trabajo' },
  { value: 'employee', label: 'Empleado' },
  { value: 'contract', label: 'Contrato' },
]

const MODEL_LABELS: Record<string, string> = {
  tenant: 'Empresa',
  position: 'Cargo',
  cost_center: 'Centro costo',
  work_location: 'Sede',
  work_center: 'Centro trabajo',
  employee: 'Empleado',
  contract: 'Contrato',
}

export default function SyncLogsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [filterModel, setFilterModel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: config } = useQuery({
    queryKey: ['nomiweb-config', id],
    queryFn: () => nomiwebConfigApi.retrieve(id!),
    enabled: !!id,
  })

  const params: Record<string, string> = { config: id!, page: String(page) }
  if (filterModel) params.model_name = filterModel
  if (filterStatus) params.status = filterStatus

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sync-logs', id, page, filterModel, filterStatus],
    queryFn: () => syncLogApi.list(params),
    enabled: !!id,
  })

  if (!user?.is_staff) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-lg font-bold text-summa-ink">Acceso restringido</h2>
        <p className="text-sm text-summa-ink-light">Solo los administradores pueden ver los logs.</p>
      </div>
    )
  }

  const columns = [
    {
      key: 'created_at',
      header: 'Fecha',
      render: (row: SyncLog) => (
        <span className="text-xs text-summa-ink-light whitespace-nowrap">
          {new Date(row.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'model_name',
      header: 'Modelo',
      render: (row: SyncLog) => (
        <span className="text-xs font-medium text-summa-ink">
          {MODEL_LABELS[row.model_name] ?? row.model_name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row: SyncLog) => (
        <Badge
          variant={row.status === 'success' ? 'green' : row.status === 'error' ? 'red' : 'gray'}
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (row: SyncLog) => (
        <span className="text-xs text-summa-ink-light">{row.action || '—'}</span>
      ),
    },
    {
      key: 'nomiweb_id',
      header: 'ID Nomiweb',
      render: (row: SyncLog) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.nomiweb_id || '—'}</span>
      ),
    },
    {
      key: 'hcm_id',
      header: 'ID HCM',
      render: (row: SyncLog) => (
        <span className="font-mono text-xs text-summa-ink-light">
          {row.hcm_id ? row.hcm_id.slice(0, 8) + '…' : '—'}
        </span>
      ),
    },
    {
      key: 'error_message',
      header: 'Error',
      render: (row: SyncLog) =>
        row.error_message ? (
          <span className="text-xs text-red-600 max-w-xs truncate block" title={row.error_message}>
            {row.error_message}
          </span>
        ) : null,
    },
  ]

  return (
    <div className="animate-fade-in">
      <Breadcrumb
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Integraciones', to: '/admin/integrations' },
          { label: config?.tenant_name ?? 'Configuración', to: `/admin/integrations/${id}` },
          { label: 'Logs' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Logs de sincronización</h1>
          {config && (
            <p className="text-sm text-summa-ink-light mt-1">
              {config.tenant_name} — Empresa ID: {config.nomiweb_empresa_id}
            </p>
          )}
        </div>
        <Link to={`/admin/integrations/${id}`} className="btn-ghost">
          ← Volver a configuración
        </Link>
      </div>

      {error && (
        <ErrorAlert message="Error al cargar los logs." error={error} onRetry={refetch} className="mb-4" />
      )}

      <div className="card p-4">
        <div className="flex gap-3 mb-4">
          <select
            value={filterModel}
            onChange={(e) => { setFilterModel(e.target.value); setPage(1) }}
            className="input max-w-48"
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
            className="input max-w-40"
          >
            <option value="">Todos los estados</option>
            <option value="success">Exitoso</option>
            <option value="error">Error</option>
            <option value="skipped">Omitido</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data?.results ?? []}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay logs registrados."
          page={page}
          pageSize={50}
          total={data?.count}
          onPageChange={(p) => setPage(p)}
        />
      </div>
    </div>
  )
}
