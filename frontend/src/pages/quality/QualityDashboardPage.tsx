import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { qualityApi } from '@/api/quality'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'

const NC_STATUS_COLORS: Record<string, string> = {
  open: '#d52680', investigating: '#959bcc', action_plan: '#212f87',
  verification: '#7dc7e9', closed: '#22c55e',
}
const NC_STATUS_LABELS: Record<string, string> = {
  open: 'Abierta', investigating: 'Investigando', action_plan: 'Plan de acción',
  verification: 'Verificación', closed: 'Cerrada',
}
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#d52680', major: '#959bcc', minor: '#7dc7e9',
}
const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítica', major: 'Mayor', minor: 'Menor',
}
const AUDIT_STATUS_LABELS: Record<string, { label: string; variant: 'green' | 'cyan' | 'navy' | 'gray' | 'magenta' }> = {
  planned: { label: 'Planificada', variant: 'navy' },
  in_progress: { label: 'En curso', variant: 'cyan' },
  completed: { label: 'Completada', variant: 'green' },
  cancelled: { label: 'Cancelada', variant: 'magenta' },
}

export default function QualityDashboardPage() {
  const { data: dash, isLoading, error, refetch } = useQuery({
    queryKey: ['quality-dashboard'],
    queryFn: qualityApi.dashboard,
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert message="Error al cargar el dashboard." onRetry={refetch} />
  if (!dash) return <ErrorAlert message="No hay datos disponibles." />

  const ncStatusData = Object.entries(dash.nonconformities_by_status).map(([k, v]) => ({
    name: NC_STATUS_LABELS[k] ?? k,
    value: v,
    color: NC_STATUS_COLORS[k] ?? '#6b6894',
  }))

  const severityData = Object.entries(dash.nonconformities_by_severity).map(([k, v]) => ({
    name: SEVERITY_LABELS[k] ?? k,
    value: v,
    fill: SEVERITY_COLORS[k] ?? '#6b6894',
  }))

  const docStatusData = Object.entries(dash.documents_by_status).map(([k, v]) => ({
    name: k, value: v,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[{ label: 'Calidad', to: '/quality' }, { label: 'Dashboard' }]} />

      <div className="page-header">
        <h1 className="page-title">Dashboard de Calidad</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Procesos activos', value: dash.active_processes, sub: `de ${dash.total_processes} totales`, to: '/quality/processes' },
          { label: 'Documentos', value: dash.total_documents, sub: `${docStatusData.find(d => d.name === 'approved')?.value ?? 0} aprobados`, to: '/quality/processes' },
          { label: 'NC abiertas', value: dash.open_nonconformities, sub: 'pendientes de cierre', to: '/quality/nonconformities' },
          { label: 'Auditorías recientes', value: dash.recent_audits.length, sub: 'últimas', to: '/quality/audits' },
        ].map(({ label, value, sub, to }) => (
          <Link key={label} to={to} className="card p-4 hover:shadow-summa-md transition-shadow group">
            <p className="text-3xl font-bold text-summa-ink">{value}</p>
            <p className="text-sm font-semibold text-summa-ink mt-1 group-hover:text-summa-navy transition-colors">{label}</p>
            <p className="text-xs text-summa-ink-light mt-0.5">{sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ncStatusData.length > 0 && (
          <div className="card p-5">
            <h3 className="section-title mb-4">No conformidades por estado</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ncStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {ncStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {severityData.length > 0 && (
          <div className="card p-5">
            <h3 className="section-title mb-4">No conformidades por severidad</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={severityData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b6894' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b6894' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Cantidad">
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {dash.recent_audits.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-summa-border">
            <h3 className="section-title">Auditorías recientes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Fecha planificada</th>
                </tr>
              </thead>
              <tbody>
                {dash.recent_audits.map((audit) => {
                  const s = AUDIT_STATUS_LABELS[audit.status] ?? { label: audit.status, variant: 'gray' as const }
                  return (
                    <tr key={audit.id}>
                      <td className="font-semibold text-summa-ink">{audit.title}</td>
                      <td className="text-summa-ink-light">{audit.audit_type}</td>
                      <td><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="text-summa-ink-light">{audit.planned_start_date}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
