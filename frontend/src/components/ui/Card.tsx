interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
  surface?: boolean
}

export function Card({ children, className = '', padding = true, surface = false }: CardProps) {
  const base = surface ? 'card-surface' : 'card'
  return (
    <div className={`${base} ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className ?? ''}`}>
      <div>
        <h3 className="text-base font-bold text-summa-ink">{title}</h3>
        {subtitle && <p className="text-sm text-summa-ink-light mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
