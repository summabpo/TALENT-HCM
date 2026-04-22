import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { tenantsApi } from '@/api/tenants'
import { useAuth } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { TenantModuleConfig } from '@/types'

interface ModuleDef {
  key: keyof TenantModuleConfig
  label: string
  description: string
  phase: 1 | 2
  icon: React.ReactNode
}

const MODULES: ModuleDef[] = [
  {
    key: 'hiring',
    label: 'Contratación',
    description: 'Gestión de procesos de selección, candidatos y contratación.',
    phase: 1,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'personnel',
    label: 'Personal',
    description: 'Gestión de empleados, contratos, documentos y onboarding.',
    phase: 1,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'quality',
    label: 'Calidad ISO 9001',
    description: 'Procesos, documentos, auditorías y no conformidades bajo ISO 9001.',
    phase: 1,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    key: 'performance',
    label: 'Desempeño (KPIs & OKRs)',
    description: 'Objetivos, resultados clave e indicadores de desempeño.',
    phase: 1,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    key: 'evaluations',
    label: 'Evaluaciones',
    description: 'Evaluaciones de desempeño y planes de desarrollo.',
    phase: 1,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: 'portal',
    label: 'Portal del Empleado',
    description: 'Autoservicio: nómina, vacaciones, solicitudes y documentos personales.',
    phase: 2,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    key: 'surveys',
    label: 'Encuestas de Clima',
    description: 'Encuestas de satisfacción, clima laboral y pulso organizacional.',
    phase: 2,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    key: 'orgchart',
    label: 'Organigrama',
    description: 'Estructura organizacional interactiva con jerarquías y reportes.',
    phase: 2,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
]

const EMPTY_MODULES: TenantModuleConfig = {
  hiring: false,
  personnel: false,
  quality: false,
  performance: false,
  evaluations: false,
  portal: false,
  surveys: false,
  orgchart: false,
}

export default function TenantModulesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [modules, setModules] = useState<TenantModuleConfig>(EMPTY_MODULES)
  const [saved, setSaved] = useState(false)

  const { data: tenant } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantsApi.get(id!),
    enabled: !!id,
  })

  const { data: currentModules, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant-modules', id],
    queryFn: () => tenantsApi.getModules(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (currentModules) setModules(currentModules)
  }, [currentModules])

  const saveMutation = useMutation({
    mutationFn: () => tenantsApi.updateModules(id!, modules),
    onSuccess: (data) => {
      setModules(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (!user?.is_staff) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-lg font-bold text-summa-ink">Acceso restringido</h2>
        <p className="text-sm text-summa-ink-light">Solo los administradores pueden acceder a esta sección.</p>
      </div>
    )
  }

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert message="No se pudo cargar la configuración de módulos." onRetry={refetch} />

  const activeCount = Object.values(modules).filter(Boolean).length
  const totalCount = MODULES.length

  const phase1 = MODULES.filter(m => m.phase === 1)
  const phase2 = MODULES.filter(m => m.phase === 2)

  function toggle(key: keyof TenantModuleConfig) {
    setModules(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="animate-fade-in">
      <Breadcrumb items={[
        { label: 'Admin', to: '/admin' },
        { label: 'Empresas', to: '/admin/tenants' },
        { label: tenant?.name ?? '…', to: `/admin/tenants/${id}/edit` },
        { label: 'Módulos' },
      ]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Configurar módulos</h1>
          {tenant && <p className="text-sm text-summa-ink-light mt-1">{tenant.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-summa-ink-light">
            <span className="font-bold text-summa-navy">{activeCount}</span> de {totalCount} módulos activos
          </span>
        </div>
      </div>

      {saved && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-summa bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-semibold">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Configuración de módulos guardada.
        </div>
      )}

      <div className="space-y-4 mb-6">
        {/* Phase 1 */}
        <div className="bg-white rounded-summa-lg border border-summa-border p-6">
          <h2 className="section-title">Fase 1 — Módulos disponibles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {phase1.map((mod) => (
              <ModuleToggle
                key={mod.key}
                mod={mod}
                enabled={modules[mod.key]}
                onToggle={() => toggle(mod.key)}
              />
            ))}
          </div>
        </div>

        {/* Phase 2 */}
        <div className="bg-white rounded-summa-lg border border-summa-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="section-title mb-0">Fase 2 — Próximamente</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-summa-purple/10 text-summa-ink-light">
              En desarrollo
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {phase2.map((mod) => (
              <ModuleToggle
                key={mod.key}
                mod={mod}
                enabled={modules[mod.key]}
                onToggle={() => toggle(mod.key)}
                dimmed
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pb-6">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="btn-primary"
        >
          {saveMutation.isPending
            ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
            : 'Guardar configuración'}
        </button>
        <button onClick={() => navigate('/admin/tenants')} className="btn-ghost">
          Volver
        </button>
      </div>
    </div>
  )
}

function ModuleToggle({
  mod, enabled, onToggle, dimmed = false,
}: { mod: ModuleDef; enabled: boolean; onToggle: () => void; dimmed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-3 p-4 rounded-summa border-2 text-left transition-all duration-150 w-full ${
        enabled
          ? 'border-summa-navy bg-summa-navy/5'
          : dimmed
          ? 'border-summa-border bg-summa-surface opacity-60'
          : 'border-summa-border bg-summa-surface hover:border-summa-navy/50'
      }`}
    >
      {/* Checkbox */}
      <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
        enabled ? 'bg-summa-navy border-summa-navy' : 'border-summa-border bg-white'
      }`}>
        {enabled && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Icon + text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={enabled ? 'text-summa-navy' : 'text-summa-ink-light'}>
            {mod.icon}
          </span>
          <span className={`text-sm font-semibold ${enabled ? 'text-summa-navy' : 'text-summa-ink'}`}>
            {mod.label}
          </span>
        </div>
        <p className="text-xs text-summa-ink-light leading-relaxed">{mod.description}</p>
      </div>
    </button>
  )
}
