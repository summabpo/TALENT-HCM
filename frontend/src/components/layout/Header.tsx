import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'

export default function Header() {
  const { user } = useAuth()
  const { tenant } = useTenant()

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
    : '?'

  return (
    <header className="h-14 bg-white border-b border-summa-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: tenant name */}
      <div className="flex items-center gap-2">
        {tenant && (
          <span className="text-sm font-semibold text-summa-ink">{tenant.name}</span>
        )}
      </div>

      {/* Right: user avatar + name */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-summa-ink-light hidden sm:block">{user?.fullName || user?.email}</span>
        <div className="w-8 h-8 rounded-full bg-summa-gradient flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">{initials}</span>
        </div>
      </div>
    </header>
  )
}
