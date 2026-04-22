import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Tenant } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [tenants, setTenants]   = useState<Tenant[] | null>(null)
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await login({ email, password, ...(tenantId ? { tenant_id: tenantId } : {}) })
      if (result.tenant_required && result.tenants) {
        setTenants(result.tenants)
      } else {
        navigate('/', { replace: true })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { non_field_errors?: string[] } } })
        ?.response?.data?.non_field_errors?.[0] ?? 'Correo o contraseña incorrectos.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-summa-surface overflow-hidden">
      {/* ── Left panel: brand + shapes ── */}
      <div className="hidden lg:flex w-1/2 bg-summa-navy relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* Large magenta blob */}
        <div
          className="absolute -top-24 -left-16 w-72 h-72 opacity-20 pointer-events-none"
          style={{
            background: '#d52680',
            borderRadius: '70% 30% 50% 50% / 40% 60% 40% 60%',
          }}
        />
        {/* Cyan blob bottom right */}
        <div
          className="absolute -bottom-20 -right-10 w-64 h-64 opacity-15 pointer-events-none"
          style={{
            background: '#7dc7e9',
            borderRadius: '40% 60% 30% 70% / 60% 40% 60% 40%',
          }}
        />
        {/* Purple triangle accent */}
        <div
          className="absolute top-1/3 right-8 w-20 h-20 opacity-20 pointer-events-none"
          style={{
            background: '#959bcc',
            clipPath: 'polygon(50% 0%, 100% 86%, 0% 86%)',
            borderRadius: '6px',
          }}
        />
        {/* Small magenta triangle */}
        <div
          className="absolute bottom-1/4 left-12 w-12 h-12 opacity-30 pointer-events-none"
          style={{
            background: '#d52680',
            clipPath: 'polygon(50% 0%, 100% 86%, 0% 86%)',
            borderRadius: '4px',
            transform: 'rotate(180deg)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-summa-magenta flex items-center justify-center mx-auto mb-8 shadow-accent">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">SUMMA BPO</h1>
          <p className="text-white/60 text-lg font-medium">Talent HCM</p>
          <p className="text-white/40 text-sm mt-4 max-w-xs leading-relaxed">
            Plataforma de gestión de talento humano para empresas que impulsan el desarrollo de su gente.
          </p>
        </div>

        {/* Horizontal gradient rule */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-summa-gradient-r" />
      </div>

      {/* ── Right panel: form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-summa-navy flex items-center justify-center">
              <span className="text-white font-bold">S</span>
            </div>
            <div>
              <p className="font-bold text-summa-ink leading-none">SUMMA BPO</p>
              <p className="text-xs text-summa-ink-light">Talent HCM</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-summa-ink">Iniciar sesión</h2>
            <p className="text-summa-ink-light text-sm mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                autoComplete="email"
                placeholder="correo@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {tenants && (
              <div>
                <label className="block text-sm font-semibold text-summa-ink mb-1.5">
                  Selecciona empresa
                </label>
                <select
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="input"
                >
                  <option value="">— Seleccionar —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id} data-slug={(t as any).slug}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-summa bg-summa-magenta/5 border border-summa-magenta/20">
                <svg className="w-4 h-4 text-summa-magenta flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-summa-magenta font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {submitting ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{' '}Ingresando...</>
              ) : 'Ingresar'}
            </button>
          </form>

          <p className="text-center text-xs text-summa-ink-light mt-8">
            © {new Date().getFullYear()} SUMMA BPO · Talent HCM
          </p>
        </div>
      </div>
    </div>
  )
}
