/* SUMMA status → badge variant mapping:
   open / active / hired   → magenta  (action required / positive)
   completed / approved    → cyan     (done)
   draft / pending         → purple   (neutral)
   cancelled / rejected    → gray
   navy                    → navy     (informational)
*/
const variants = {
  green:  'badge-cyan',      // completed / approved
  cyan:   'badge-cyan',
  blue:   'badge-navy',
  red:    'badge-magenta',   // danger / open NC
  yellow: 'badge-purple',    // warning / in-progress
  gray:   'badge-gray',
  purple: 'badge-purple',
  orange: 'badge-purple',
  navy:   'badge-navy',
  magenta:'badge-magenta',
} as const

type Variant = keyof typeof variants

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  className?: string
}

export default function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
