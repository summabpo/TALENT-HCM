import { Link } from 'react-router-dom'

interface BreadcrumbItem { label: string; to?: string }

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm mb-5 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-summa-border font-light">/</span>}
          {item.to ? (
            <Link to={item.to} className="text-summa-ink-light hover:text-summa-magenta font-medium transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-summa-ink font-semibold">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
