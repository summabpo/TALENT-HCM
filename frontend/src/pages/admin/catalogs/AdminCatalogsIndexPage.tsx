import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  adminCountriesApi,
  adminStatesApi,
  adminCitiesApi,
  adminDocumentTypesApi,
  adminBanksApi,
  adminSocialSecurityApi,
} from '@/api/catalogs'
import { useAuth, useGlobalCatalogWriteAccess } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'

interface CatalogCard {
  label: string
  description: string
  to: string
  count: number | undefined
  loading: boolean
  icon: React.ReactNode
}

const GlobeIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
)
const MapIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
  </svg>
)
const BuildingIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
)
const IdIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
  </svg>
)
const BankIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
)
const HeartIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
)

export default function AdminCatalogsIndexPage() {
  const { user } = useAuth()
  const canWriteGlobal = useGlobalCatalogWriteAccess()
  const navigate = useNavigate()

  const { data: countries, isLoading: lCountries } = useQuery({
    queryKey: ['admin-catalog-count-countries'],
    queryFn: () => adminCountriesApi.list({ page_size: '1' }),
  })
  const { data: states, isLoading: lStates } = useQuery({
    queryKey: ['admin-catalog-count-states'],
    queryFn: () => adminStatesApi.list({ page_size: '1' }),
  })
  const { data: cities, isLoading: lCities } = useQuery({
    queryKey: ['admin-catalog-count-cities'],
    queryFn: () => adminCitiesApi.list({ page_size: '1' }),
  })
  const { data: docTypes, isLoading: lDocTypes } = useQuery({
    queryKey: ['admin-catalog-count-doc-types'],
    queryFn: () => adminDocumentTypesApi.list({ page_size: '1' }),
  })
  const { data: banks, isLoading: lBanks } = useQuery({
    queryKey: ['admin-catalog-count-banks'],
    queryFn: () => adminBanksApi.list({ page_size: '1' }),
  })
  const { data: social, isLoading: lSocial } = useQuery({
    queryKey: ['admin-catalog-count-social'],
    queryFn: () => adminSocialSecurityApi.list({ page_size: '1' }),
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
        <p className="text-sm text-summa-ink-light">Solo los administradores pueden gestionar los catálogos globales.</p>
      </div>
    )
  }

  const cards: CatalogCard[] = [
    {
      label: 'Países',
      description: 'Países disponibles en la plataforma',
      to: '/admin/catalogs/countries',
      count: countries?.count,
      loading: lCountries,
      icon: <GlobeIcon />,
    },
    {
      label: 'Departamentos',
      description: 'Departamentos / estados por país',
      to: '/admin/catalogs/states',
      count: states?.count,
      loading: lStates,
      icon: <MapIcon />,
    },
    {
      label: 'Ciudades',
      description: 'Municipios y ciudades por departamento',
      to: '/admin/catalogs/cities',
      count: cities?.count,
      loading: lCities,
      icon: <BuildingIcon />,
    },
    {
      label: 'Tipos de Documento',
      description: 'Cédula, pasaporte, NIT y otros',
      to: '/admin/catalogs/document-types',
      count: docTypes?.count,
      loading: lDocTypes,
      icon: <IdIcon />,
    },
    {
      label: 'Bancos',
      description: 'Entidades bancarias para pagos',
      to: '/admin/catalogs/banks',
      count: banks?.count,
      loading: lBanks,
      icon: <BankIcon />,
    },
    {
      label: 'Seg. Social',
      description: 'EPS, AFP, ARL, CCF y cesantías',
      to: '/admin/catalogs/social-security',
      count: social?.count,
      loading: lSocial,
      icon: <HeartIcon />,
    },
  ]

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[{ label: 'Admin', to: '/admin' }, { label: 'Catálogos globales' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogos globales</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Datos de referencia compartidos por todos los clientes de la plataforma
          </p>
          {!canWriteGlobal && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 mt-3 max-w-2xl">
              Modo solo lectura: podés consultar y filtrar listados. La creación, edición y baja de registros solo está
              permitida para un superusuario de plataforma.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.to}
            className="card p-5 flex flex-col gap-4 hover:shadow-summa-lg transition-shadow cursor-pointer group"
            onClick={() => navigate(card.to)}
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl bg-summa-navy/8 flex items-center justify-center text-summa-navy group-hover:bg-summa-magenta/10 group-hover:text-summa-magenta transition-colors">
                {card.icon}
              </div>
              <div className="text-right">
                {card.loading ? (
                  <div className="w-10 h-6 bg-summa-surface-dark rounded animate-pulse" />
                ) : (
                  <span className="text-2xl font-bold text-summa-navy tabular-nums">
                    {card.count?.toLocaleString('es-CO') ?? '—'}
                  </span>
                )}
                <p className="text-[10px] font-semibold text-summa-ink-light uppercase tracking-wider mt-0.5">
                  registros
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-summa-ink text-sm group-hover:text-summa-magenta transition-colors">
                {card.label}
              </h3>
              <p className="text-xs text-summa-ink-light mt-0.5 leading-relaxed">{card.description}</p>
            </div>
            <div className="mt-auto">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-summa-navy group-hover:text-summa-magenta transition-colors">
                {canWriteGlobal ? 'Gestionar' : 'Ver listado'}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
