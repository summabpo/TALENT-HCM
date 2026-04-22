export default function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-3 ${className}`}>
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-4 border-summa-surface-dark" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-summa-magenta animate-spin" />
      </div>
      <span className="text-sm text-summa-ink-light font-medium">Cargando...</span>
    </div>
  )
}
