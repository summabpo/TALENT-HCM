interface ProgressBarProps {
  value: number
  max?: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}

function barColor(pct: number) {
  if (pct >= 80) return 'bg-summa-cyan'
  if (pct >= 50) return 'bg-summa-navy'
  if (pct >= 25) return 'bg-summa-purple'
  return 'bg-summa-magenta'
}

export default function ProgressBar({ value, max = 100, showLabel = true, size = 'md' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex-1 rounded-full ${height} bg-summa-surface-dark overflow-hidden`}>
        <div
          className={`${barColor(pct)} ${height} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-summa-ink-light w-9 text-right tabular-nums">
          {pct}%
        </span>
      )}
    </div>
  )
}
