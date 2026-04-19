import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'

export default function Header() {
  const { user } = useAuth()
  const { tenant } = useTenant()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <span className="text-sm text-gray-500">{tenant?.name}</span>
      <span className="text-sm font-medium text-gray-700">{user?.fullName || user?.email}</span>
    </header>
  )
}
