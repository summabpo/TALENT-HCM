import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { TenantModules } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  children?: { to: string; label: string }[]
}

const Icon = {
  Home: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Personnel: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Hiring: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Quality: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  Performance: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  Catalogs: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  Integration: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Admin: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
}

const allModules: { moduleKey: keyof TenantModules; items: NavItem[] }[] = [
  {
    moduleKey: 'personnel',
    items: [{ to: '/personnel/employees', label: 'Personal', icon: <Icon.Personnel />, children: [{ to: '/personnel/employees', label: 'Empleados' }] }],
  },
  {
    moduleKey: 'hiring',
    items: [{ to: '/hiring/processes', label: 'Contratación', icon: <Icon.Hiring />, children: [{ to: '/hiring/processes', label: 'Procesos' }] }],
  },
  {
    moduleKey: 'quality',
    items: [{ to: '/quality', label: 'Calidad', icon: <Icon.Quality />, children: [
      { to: '/quality/dashboard', label: 'Dashboard' },
      { to: '/quality/processes', label: 'Procesos' },
      { to: '/quality/nonconformities', label: 'No conformidades' },
    ]}],
  },
  {
    moduleKey: 'performance',
    items: [{ to: '/performance', label: 'Desempeño', icon: <Icon.Performance />, children: [
      { to: '/performance/periods', label: 'Periodos OKR' },
      { to: '/performance/kpis', label: 'KPIs' },
    ]}],
  },
  {
    moduleKey: 'evaluations',
    items: [{ to: '/', label: 'Evaluaciones', icon: <Icon.Performance />, children: [{ to: '/', label: 'Próximamente' }] }],
  },
]

export default function Sidebar() {
  const { modules, logout, user, tenant } = useAuth()
  const location = useLocation()
  /** Super usuario sin empresa en sesión: solo administración global, no módulos operativos. */
  const isPlatformSuperuser = user?.is_superuser === true && !tenant

  const navInactive =
    'text-summaNavy hover:text-summa-magenta hover:bg-summa-magenta/10'
  /* Activo: fucsia #d52680 sobre tinte (evita texto blanco si falla el bg sólido) */
  const navActive =
    'bg-summa-magenta/12 text-summa-magenta font-semibold shadow-sm ring-1 ring-summa-magenta/20'

  return (
    <aside className="w-56 bg-summa-surface border-r border-summa-border flex flex-col min-h-screen flex-shrink-0 relative overflow-hidden">
      {/* Decorative shapes (SUMMA universo gráfico) */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.15] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7dc7e9, transparent)' }}
      />
      <div
        className="absolute bottom-32 -left-6 w-20 h-20 opacity-[0.12] pointer-events-none"
        style={{
          background: '#d52680',
          borderRadius: '60% 40% 70% 30% / 50% 60% 40% 50%',
          transform: 'rotate(30deg)',
        }}
      />
      <div
        className="absolute bottom-10 right-2 w-14 h-14 opacity-[0.12] pointer-events-none"
        style={{
          background: '#959bcc',
          clipPath: 'polygon(50% 0%, 100% 86%, 0% 86%)',
          borderRadius: '8px',
        }}
      />

      {/* Logo */}
      <div className="px-5 py-5 border-b border-summa-border relative">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-summaMagenta flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <div>
            <p className="text-summaNavy font-bold text-sm tracking-tight leading-none">SUMMA</p>
            <p className="text-summa-ink-light text-[10px] font-medium tracking-widest uppercase">Talent HCM</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="mb-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-summa text-sm font-semibold transition-all duration-150 ${
                isActive ? navActive : navInactive
              }`
            }
          >
            <Icon.Home />
            Inicio
          </NavLink>
        </div>

        {!isPlatformSuperuser &&
          allModules.map(({ moduleKey, items }) => {
            if (modules && !modules[moduleKey]) return null
            return items.map(({ to, label, icon, children }) => {
              const isActive = location.pathname.startsWith(`/${moduleKey}`)
              return (
                <div key={to}>
                  <NavLink
                    to={to}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-summa text-sm font-semibold transition-all duration-150 ${
                      isActive ? navActive : navInactive
                    }`}
                  >
                    {icon}
                    {label}
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-summa-magenta" />
                    )}
                  </NavLink>

                  {children && isActive && (
                    <div className="ml-9 mt-0.5 space-y-0.5">
                      {children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive: childActive }) =>
                            `block px-3 py-1.5 rounded-summa text-xs font-medium transition-all duration-150 ${
                              childActive
                                ? 'text-summaMagenta bg-summa-magenta/10 font-semibold'
                                : 'text-summaGray hover:text-summaMagenta hover:bg-summa-magenta/10'
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          })}

        {/* Settings — catálogos tenant (oculto para superusuario de plataforma) */}
        {!isPlatformSuperuser && (
        <div className="border-t border-summa-border pt-2 mt-2">
          <p className="px-3 py-1 text-[10px] font-bold text-summa-ink-light uppercase tracking-widest">
            Configuración
          </p>
          {(() => {
            const isCatalogsActive = location.pathname.startsWith('/settings/catalogs')
            return (
              <div>
                <NavLink
                  to="/settings/catalogs"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-summa text-sm font-semibold transition-all duration-150 ${
                    isCatalogsActive ? navActive : navInactive
                  }`}
                >
                  <Icon.Settings />
                  Catálogos
                  {isCatalogsActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-summa-magenta" />
                  )}
                </NavLink>
                {isCatalogsActive && (
                  <div className="ml-9 mt-0.5 space-y-0.5">
                    {[
                      { to: '/settings/catalogs/organizational-levels', label: 'Niveles org.' },
                      { to: '/settings/catalogs/positions', label: 'Cargos' },
                      { to: '/settings/catalogs/cost-centers', label: 'Centros de costo' },
                      { to: '/settings/catalogs/sub-cost-centers', label: 'Sub-centros' },
                      { to: '/settings/catalogs/work-locations', label: 'Sedes' },
                      { to: '/settings/catalogs/work-centers', label: 'Centros de trabajo' },
                    ].map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive: childActive }) =>
                          `block px-3 py-1.5 rounded-summa text-xs font-medium transition-all duration-150 ${
                            childActive
                              ? 'text-summaMagenta bg-summa-magenta/10 font-semibold'
                              : 'text-summaGray hover:text-summaMagenta hover:bg-summa-magenta/10'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        )}

        {/* Admin — staff only */}
        {user?.is_staff && (
          <div className="border-t border-summa-border pt-2 mt-2">
            <p className="px-3 py-1 text-[10px] font-bold text-summa-ink-light uppercase tracking-widest">
              Administración
            </p>
            <NavLink
              to="/admin/tenants"
              className={() =>
                `flex items-center gap-2.5 px-3 py-2 rounded-summa text-sm font-semibold transition-all duration-150 ${
                  location.pathname.startsWith('/admin/tenants') ? navActive : navInactive
                }`
              }
            >
              <Icon.Admin />
              Empresas
            </NavLink>
            <NavLink
              to="/admin/catalogs"
              className={() =>
                `flex items-center gap-2.5 px-3 py-2 rounded-summa text-sm font-semibold transition-all duration-150 ${
                  location.pathname.startsWith('/admin/catalogs') ? navActive : navInactive
                }`
              }
            >
              <Icon.Catalogs />
              Catálogos globales
            </NavLink>
            <NavLink
              to="/admin/integrations"
              className={() =>
                `flex items-center gap-2.5 px-3 py-2 rounded-summa text-sm font-semibold transition-all duration-150 ${
                  location.pathname.startsWith('/admin/integrations') ? navActive : navInactive
                }`
              }
            >
              <Icon.Integration />
              Integraciones
            </NavLink>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-summa-border">
        <button
          onClick={logout}
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-summa text-sm text-summa-ink-light hover:text-summaMagenta hover:bg-summa-magenta/10 transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
