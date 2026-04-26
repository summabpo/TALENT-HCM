import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { nomiwebConfigApi, syncLogApi } from '@/api/integrations'
import Breadcrumb from '@/components/ui/Breadcrumb'
import SyncStatusBadge from '@/components/integrations/SyncStatusBadge'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import type { NomiwebConfig, SyncResult, ConnectionStatus } from '@/types'

type FormValues = {
  nomiweb_empresa_id: number
  sync_enabled: boolean
  sync_interval_minutes: number
}

const MODEL_LABELS: Record<string, string> = {
  tenant: 'Empresa',
  position: 'Cargo',
  cost_center: 'Centro costo',
  work_location: 'Sede',
  work_center: 'Centro trabajo',
  employee: 'Empleado',
  contract: 'Contrato',
}

export default function IntegrationConfigPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const isNew = id === 'create'

  const [syncing, setSyncing] = useState(false)
  const [syncingCatalogs, setSyncingCatalogs] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [connResult, setConnResult] = useState<ConnectionStatus | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['nomiweb-config', id],
    queryFn: () => nomiwebConfigApi.retrieve(id!),
    enabled: !isNew,
  })

  const { data: recentLogs } = useQuery({
    queryKey: ['sync-logs-recent', id],
    queryFn: () => syncLogApi.list({ config: id!, page: '1' }),
    enabled: !isNew && !!id,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    values: config
      ? {
          nomiweb_empresa_id: config.nomiweb_empresa_id,
          sync_enabled: config.sync_enabled,
          sync_interval_minutes: config.sync_interval_minutes,
        }
      : undefined,
  })

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isNew) {
        return nomiwebConfigApi.create(values)
      }
      return nomiwebConfigApi.update(id!, values)
    },
    onSuccess: (saved: NomiwebConfig) => {
      qc.invalidateQueries({ queryKey: ['nomiweb-configs'] })
      if (isNew) {
        navigate(`/admin/integrations/${saved.id}`, { replace: true })
      } else {
        qc.invalidateQueries({ queryKey: ['nomiweb-config', id] })
      }
    },
  })

  async function handleTestConnection() {
    if (!id || isNew) return
    setTesting(true)
    setConnResult(null)
    setActionError(null)
    try {
      const result = await nomiwebConfigApi.testConnection(id)
      setConnResult(result)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de conexión'
      setConnResult({ ok: false, error: msg })
    } finally {
      setTesting(false)
    }
  }

  async function handleSyncNow() {
    if (!id || isNew) return
    setSyncing(true)
    setSyncResult(null)
    setActionError(null)
    try {
      const result = await nomiwebConfigApi.syncNow(id)
      setSyncResult(result)
      qc.invalidateQueries({ queryKey: ['nomiweb-config', id] })
      qc.invalidateQueries({ queryKey: ['sync-logs-recent', id] })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar'
      setActionError(msg)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncCatalogs() {
    if (!id || isNew) return
    setSyncingCatalogs(true)
    setActionError(null)
    try {
      const result = await nomiwebConfigApi.syncCatalogs(id)
      setSyncResult({ ok: result.ok, stats: result.stats })
      qc.invalidateQueries({ queryKey: ['sync-logs-recent', id] })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar catálogos'
      setActionError(msg)
    } finally {
      setSyncingCatalogs(false)
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

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-summa-navy rounded-full animate-spin" />
      </div>
    )
  }

  if (!isNew && error) {
    return <ErrorAlert message="Error al cargar la configuración." error={error} />
  }

  return (
    <div className="animate-fade-in">
      <Breadcrumb
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Integraciones', to: '/admin/integrations' },
          { label: isNew ? 'Nueva configuración' : (config?.tenant_name ?? 'Configuración') },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isNew ? 'Nueva configuración Nomiweb' : config?.tenant_name}
          </h1>
          {!isNew && config && (
            <div className="flex items-center gap-3 mt-1">
              <SyncStatusBadge status={config.last_sync_status} />
              {config.last_sync_at_display && (
                <span className="text-xs text-summa-ink-light">
                  Última sync: {config.last_sync_at_display}
                </span>
              )}
            </div>
          )}
        </div>
        {!isNew && (
          <Link to={`/admin/integrations/${id}/logs`} className="btn-ghost">
            Ver logs de sync
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Config form */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="text-sm font-bold text-summa-ink mb-4">Configuración</h2>
          {saveMutation.error && (
            <ErrorAlert message="Error al guardar." error={saveMutation.error} className="mb-3" />
          )}
          <form
            onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                ID Empresa Nomiweb <span className="text-summa-magenta">*</span>
              </label>
              <input
                type="number"
                {...register('nomiweb_empresa_id', {
                  required: 'Requerido',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Debe ser mayor a 0' },
                })}
                className="input"
                placeholder="Ej. 3"
              />
              {errors.nomiweb_empresa_id && (
                <p className="text-summa-magenta text-xs mt-1">{errors.nomiweb_empresa_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Intervalo de sincronización (min)
              </label>
              <input
                type="number"
                {...register('sync_interval_minutes', {
                  valueAsNumber: true,
                  min: { value: 5, message: 'Mínimo 5 minutos' },
                })}
                className="input"
                placeholder="60"
              />
              {errors.sync_interval_minutes && (
                <p className="text-summa-magenta text-xs mt-1">{errors.sync_interval_minutes.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2 col-span-full">
              <input
                type="checkbox"
                id="sync_enabled"
                {...register('sync_enabled')}
                className="rounded border-summa-border text-summa-navy"
              />
              <label htmlFor="sync_enabled" className="text-sm font-semibold text-summa-ink cursor-pointer">
                Sincronización activa
              </label>
            </div>

            <div className="col-span-full flex gap-2">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="btn-primary btn-sm"
              >
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/integrations')}
                className="btn-ghost btn-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        {/* Action panel */}
        {!isNew && (
          <div className="space-y-4">
            {/* Test connection */}
            <div className="card p-4">
              <h3 className="text-sm font-bold text-summa-ink mb-3">Conexión</h3>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full btn-ghost btn-sm"
              >
                {testing ? 'Probando…' : 'Probar conexión'}
              </button>
              {connResult && (
                <div className={`mt-3 p-3 rounded-summa text-xs ${connResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {connResult.ok ? (
                    <>
                      <p className="font-semibold">Conexión exitosa</p>
                      <p>{connResult.empresa_name} (ID: {connResult.empresa_id})</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Error de conexión</p>
                      <p>{connResult.error}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Sync actions */}
            <div className="card p-4">
              <h3 className="text-sm font-bold text-summa-ink mb-3">Sincronización</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncing || syncingCatalogs}
                  className="w-full btn-primary btn-sm"
                >
                  {syncing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sincronizando…
                    </span>
                  ) : (
                    'Sync completo ahora'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSyncCatalogs}
                  disabled={syncing || syncingCatalogs}
                  className="w-full btn-ghost btn-sm"
                >
                  {syncingCatalogs ? 'Sincronizando catálogos…' : 'Sync catálogos'}
                </button>
              </div>

              {actionError && (
                <div className="mt-3 p-3 rounded-summa bg-red-50 border border-red-200 text-xs text-red-700">
                  {actionError}
                </div>
              )}

              {syncResult && (
                <div className={`mt-3 p-3 rounded-summa text-xs ${syncResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {syncResult.ok ? (
                    <>
                      <p className="font-semibold mb-1">Sync completada</p>
                      {syncResult.stats && (
                        <ul className="space-y-0.5">
                          {Object.entries(syncResult.stats).map(([k, v]) =>
                            v !== undefined && v !== false ? (
                              <li key={k}>
                                {k.replace(/_/g, ' ')}: <strong>{String(v)}</strong>
                              </li>
                            ) : null,
                          )}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="font-semibold">{syncResult.error ?? 'Error desconocido'}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent logs */}
      {!isNew && recentLogs && recentLogs.results.length > 0 && (
        <div className="card p-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-summa-ink">Logs recientes</h3>
            <Link to={`/admin/integrations/${id}/logs`} className="text-xs text-summa-navy hover:text-summa-magenta transition-colors">
              Ver todos →
            </Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-summa-border">
                <th className="text-left pb-2 font-semibold text-summa-ink-light">Fecha</th>
                <th className="text-left pb-2 font-semibold text-summa-ink-light">Modelo</th>
                <th className="text-left pb-2 font-semibold text-summa-ink-light">Estado</th>
                <th className="text-left pb-2 font-semibold text-summa-ink-light">Acción</th>
                <th className="text-left pb-2 font-semibold text-summa-ink-light">ID Nomiweb</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-summa-border">
              {recentLogs.results.slice(0, 8).map((log) => (
                <tr key={log.id}>
                  <td className="py-1.5 text-summa-ink-light">
                    {new Date(log.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-1.5">
                    {MODEL_LABELS[log.model_name] ?? log.model_name}
                  </td>
                  <td className="py-1.5">
                    <Badge
                      variant={log.status === 'success' ? 'green' : log.status === 'error' ? 'red' : 'gray'}
                    >
                      {log.status}
                    </Badge>
                  </td>
                  <td className="py-1.5 text-summa-ink-light">{log.action || '—'}</td>
                  <td className="py-1.5 font-mono text-summa-ink-light">{log.nomiweb_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
