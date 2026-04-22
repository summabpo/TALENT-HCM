interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, loading = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-summa-ink/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-summa-xl shadow-summa-lg p-6 w-full max-w-md mx-4 mb-4 sm:mb-0 animate-slide-up">
        {/* Decorative accent strip */}
        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-summa-xl ${danger ? 'bg-summa-magenta' : 'bg-summa-navy'}`} />

        <div className="flex items-start gap-3 mt-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-summa-magenta/10' : 'bg-summa-navy/10'}`}>
            {danger ? (
              <svg className="w-4 h-4 text-summa-magenta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-summa-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-summa-ink text-base">{title}</h3>
            <p className="text-sm text-summa-ink-light mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} disabled={loading} className="btn-ghost btn-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={danger ? 'btn-danger btn-sm' : 'btn-primary btn-sm'}
          >
            {loading ? (
              <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />{' '}Procesando...</>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
