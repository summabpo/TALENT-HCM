import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { performanceApi } from '@/api/performance'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { KPIMeasurement } from '@/types'

export default function KPIDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useQueryClient()
  const [showAddMeasurement, setShowAddMeasurement] = useState(false)
  const [deleteMId, setDeleteMId] = useState<string | null>(null)
  const [measurementForm, setMeasurementForm] = useState({
    period_label: '', period_date: '', value: '', recorded_by: '', notes: '',
  })

  const { data: kpi, isLoading: loadingKPI, error: errKPI, refetch } = useQuery({
    queryKey: ['kpi', id],
    queryFn: () => performanceApi.kpi(id!),
    enabled: !!id,
  })

  const { data: measurements, isLoading: loadingMeasurements, refetch: refetchMeasurements } = useQuery({
    queryKey: ['measurements', id],
    queryFn: () => performanceApi.measurements(id!),
    enabled: !!id,
  })

  const addMutation = useMutation({
    mutationFn: () => performanceApi.addMeasurement(id!, measurementForm),
    onSuccess: () => {
      setShowAddMeasurement(false)
      setMeasurementForm({ period_label: '', period_date: '', value: '', recorded_by: '', notes: '' })
      refetchMeasurements()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (mId: string) => performanceApi.deleteMeasurement(id!, mId),
    onSuccess: () => { setDeleteMId(null); refetchMeasurements() },
  })

  if (loadingKPI) return <LoadingSpinner />
  if (errKPI || !kpi) return <ErrorAlert message="No se pudo cargar el KPI." onRetry={refetch} />

  const sorted = [...(measurements ?? [])].sort((a, b) => a.period_date.localeCompare(b.period_date))
  const chartData = sorted.map((m: KPIMeasurement) => ({
    name: m.period_label,
    value: Number(m.value),
  }))
  const latest = sorted[sorted.length - 1]
  const onTarget = latest ? Number(latest.value) >= Number(kpi.target_value) : null

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Desempeño', to: '/performance' },
        { label: 'KPIs', to: '/performance/kpis' },
        { label: kpi.name },
      ]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">{kpi.name}</h1>
          <p className="text-sm text-summa-ink-light mt-1">{kpi.metric_type} · Meta: {Number(kpi.target_value).toLocaleString('es-CO')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={kpi.is_active ? 'green' : 'gray'}>{kpi.is_active ? 'Activo' : 'Inactivo'}</Badge>
          {onTarget !== null && (
            <Badge variant={onTarget ? 'green' : 'magenta'}>{onTarget ? 'En meta' : 'Bajo meta'}</Badge>
          )}
          <button onClick={() => navigate(`/performance/kpis/${id}/edit`)} className="btn-ghost">
            Editar
          </button>
        </div>
      </div>

      {kpi.description && (
        <Card>
          <p className="text-sm text-summa-ink">{kpi.description}</p>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader title="Tendencia de mediciones" />
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8d4ed" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b6894' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b6894' }} />
              <Tooltip
                contentStyle={{ borderRadius: '10px', border: '1px solid #d8d4ed', fontFamily: 'Outfit, sans-serif' }}
              />
              <ReferenceLine
                y={Number(kpi.target_value)}
                stroke="#d52680"
                strokeDasharray="4 4"
                label={{ value: 'Meta', position: 'right', fontSize: 11, fill: '#d52680' }}
              />
              <Line type="monotone" dataKey="value" stroke="#212f87" strokeWidth={2} dot={{ r: 4, fill: '#212f87' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card padding={false}>
        <CardHeader
          title="Historial de mediciones"
          className="px-6 pt-6 pb-4"
          action={
            <button onClick={() => setShowAddMeasurement(true)} className="btn-secondary btn-sm">
              + Agregar medición
            </button>
          }
        />

        {showAddMeasurement && (
          <div className="px-6 pb-4 border-b border-summa-border bg-summa-surface">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-summa-ink-light block mb-1">Periodo *</label>
                <input
                  value={measurementForm.period_label}
                  onChange={(e) => setMeasurementForm(f => ({ ...f, period_label: e.target.value }))}
                  placeholder="Ene 2026"
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-summa-ink-light block mb-1">Fecha *</label>
                <input
                  type="date"
                  value={measurementForm.period_date}
                  onChange={(e) => setMeasurementForm(f => ({ ...f, period_date: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-summa-ink-light block mb-1">Valor *</label>
                <input
                  type="number"
                  value={measurementForm.value}
                  onChange={(e) => setMeasurementForm(f => ({ ...f, value: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-summa-ink-light block mb-1">Registrado por</label>
                <input
                  value={measurementForm.recorded_by}
                  onChange={(e) => setMeasurementForm(f => ({ ...f, recorded_by: e.target.value }))}
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-summa-ink-light block mb-1">Notas</label>
                <input
                  value={measurementForm.notes}
                  onChange={(e) => setMeasurementForm(f => ({ ...f, notes: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={!measurementForm.period_label || !measurementForm.period_date || !measurementForm.value || addMutation.isPending}
                onClick={() => addMutation.mutate()}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                {addMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setShowAddMeasurement(false)} className="btn-ghost btn-sm">Cancelar</button>
            </div>
          </div>
        )}

        {loadingMeasurements ? (
          <LoadingSpinner />
        ) : sorted.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-summa-ink-light">Sin mediciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Fecha</th>
                  <th className="text-right">Valor</th>
                  <th>Registrado por</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((m: KPIMeasurement) => {
                  const onMeta = Number(m.value) >= Number(kpi.target_value)
                  return (
                    <tr key={m.id}>
                      <td className="font-semibold text-summa-ink">{m.period_label}</td>
                      <td className="text-summa-ink-light">{m.period_date}</td>
                      <td className="text-right">
                        <span className={`font-bold tabular-nums ${onMeta ? 'text-emerald-600' : 'text-summa-magenta'}`}>
                          {Number(m.value).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td className="text-summa-ink-light">{m.recorded_by || '—'}</td>
                      <td className="text-right">
                        <button onClick={() => setDeleteMId(m.id)} className="text-xs text-summa-magenta hover:underline font-semibold">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteMId}
        title="Eliminar medición"
        message="¿Eliminar esta medición?"
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMId && deleteMutation.mutate(deleteMId)}
        onCancel={() => setDeleteMId(null)}
      />
    </div>
  )
}
