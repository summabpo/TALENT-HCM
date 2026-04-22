import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { personnelApi } from '@/api/personnel'
import { hiringApi } from '@/api/hiring'
import { qualityApi } from '@/api/quality'
import { performanceApi } from '@/api/performance'
import { Card } from '@/components/ui/Card'

function StatCard({
  label,
  value,
  hint,
  to,
  loading,
}: {
  label: string
  value: string | number
  hint?: string
  to: string
  loading?: boolean
}) {
  return (
    <Link
      to={to}
      className="card p-5 hover:shadow-summa-md transition-shadow group block"
    >
      {loading ? (
        <div className="h-16 flex items-center">
          <div className="h-8 w-20 bg-summa-surface-dk rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-summa-ink tabular-nums">{value}</p>
          <p className="text-sm font-semibold text-summa-ink mt-1 group-hover:text-summa-navy transition-colors">
            {label}
          </p>
          {hint && <p className="text-xs text-summa-ink-light mt-0.5">{hint}</p>}
        </>
      )}
    </Link>
  )
}

export default function DashboardPage() {
  const { user, tenant, modules } = useAuth()

  const employeesQuery = useQuery({
    queryKey: ['dashboard', 'employees-count'],
    queryFn: () => personnelApi.employees({ page: '1' }),
    enabled: !!modules?.personnel,
  })

  const hiringQuery = useQuery({
    queryKey: ['dashboard', 'hiring-open-count'],
    queryFn: () => hiringApi.processes({ page: '1', status: 'open' }),
    enabled: !!modules?.hiring,
  })

  const qualityQuery = useQuery({
    queryKey: ['dashboard', 'quality-summary'],
    queryFn: qualityApi.dashboard,
    enabled: !!modules?.quality,
  })

  const performanceQuery = useQuery({
    queryKey: ['dashboard', 'performance-summary'],
    queryFn: performanceApi.dashboard,
    enabled: !!modules?.performance,
  })

  const quickLinks: {
    to: string
    title: string
    description: string
    key: keyof NonNullable<typeof modules>
  }[] = [
    {
      key: 'personnel',
      to: '/personnel/employees',
      title: 'Personal',
      description: 'Empleados, contratos y documentación',
    },
    {
      key: 'hiring',
      to: '/hiring/processes',
      title: 'Contratación',
      description: 'Procesos y candidatos',
    },
    {
      key: 'quality',
      to: '/quality/dashboard',
      title: 'Calidad',
      description: 'ISO, auditorías y no conformidades',
    },
    {
      key: 'performance',
      to: '/performance/periods',
      title: 'Desempeño',
      description: 'OKR y KPIs',
    },
  ]

  const visibleLinks = modules
    ? quickLinks.filter((l) => modules[l.key])
    : quickLinks

  return (
    <div className="space-y-8 max-w-5xl animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inicio</h1>
          <p className="text-summa-ink-light mt-1">
            Hola, <span className="font-semibold text-summa-ink">{user?.fullName ?? user?.email}</span>
            {tenant?.name ? (
              <>
                {' '}
                · <span className="text-summa-ink">{tenant.name}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <Card>
        <p className="text-sm text-summa-ink leading-relaxed">
          Bienvenido al panel de Talent HCM. Aquí tienes un resumen de tu organización y accesos rápidos a los
          módulos activos.
        </p>
      </Card>

      <div>
        <h2 className="section-title">Indicadores</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules?.personnel && (
            <StatCard
              label="Empleados"
              value={employeesQuery.data?.count ?? '—'}
              hint="registrados en el sistema"
              to="/personnel/employees"
              loading={employeesQuery.isPending}
            />
          )}
          {modules?.hiring && (
            <StatCard
              label="Procesos abiertos"
              value={hiringQuery.data?.count ?? '—'}
              hint="contratación activa"
              to="/hiring/processes"
              loading={hiringQuery.isPending}
            />
          )}
          {modules?.quality && (
            <StatCard
              label="NC abiertas"
              value={qualityQuery.data?.open_nonconformities ?? '—'}
              hint="no conformidades pendientes"
              to="/quality/nonconformities"
              loading={qualityQuery.isPending}
            />
          )}
          {modules?.performance && (
            <StatCard
              label="KPIs activos"
              value={performanceQuery.data?.active_kpis_count ?? '—'}
              hint="indicadores en seguimiento"
              to="/performance/kpis"
              loading={performanceQuery.isPending}
            />
          )}
        </div>
        {modules &&
          !modules.personnel &&
          !modules.hiring &&
          !modules.quality &&
          !modules.performance && (
            <p className="text-sm text-summa-ink-light">No hay módulos habilitados para tu cuenta.</p>
          )}
      </div>

      <div>
        <h2 className="section-title">Accesos rápidos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card p-4 flex flex-col gap-1 hover:border-summa-magenta/30 hover:shadow-summa-sm transition-all group"
            >
              <span className="font-semibold text-summa-navy group-hover:text-summa-magenta transition-colors">
                {item.title}
              </span>
              <span className="text-sm text-summa-ink-light">{item.description}</span>
            </Link>
          ))}
          <Link
            to="/catalogs"
            className="card p-4 flex flex-col gap-1 hover:border-summa-magenta/30 hover:shadow-summa-sm transition-all group"
          >
            <span className="font-semibold text-summa-navy group-hover:text-summa-magenta transition-colors">
              Catálogos
            </span>
            <span className="text-sm text-summa-ink-light">Datos maestros y referencias</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
