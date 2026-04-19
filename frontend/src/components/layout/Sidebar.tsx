import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const navItems = [
  { to: '/personnel', labelKey: 'nav.personnel' },
  { to: '/hiring', labelKey: 'nav.hiring' },
  { to: '/quality', labelKey: 'nav.quality' },
  { to: '/performance', labelKey: 'nav.performance' },
  { to: '/catalogs', labelKey: 'nav.catalogs' },
]

export default function Sidebar() {
  const { t } = useTranslation()

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-xl font-semibold tracking-tight">Talent HCM</span>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map(({ to, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
