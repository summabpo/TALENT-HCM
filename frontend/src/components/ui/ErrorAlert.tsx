import { isAxiosError } from 'axios'

interface ErrorAlertProps {
  message?: string
  /** React Query / mutation error, Axios, etc. Shown in dev or when VITE_SHOW_API_ERRORS=true. */
  error?: unknown
  onRetry?: () => void
  className?: string
}

function shouldShowErrorDebug(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_SHOW_API_ERRORS === 'true'
}

function formatErrorDebug(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const st = status != null ? `HTTP ${status}` : null
    const data = err.response?.data
    let msg = err.message
    if (data && typeof data === 'object' && 'detail' in data) {
      const d = (data as { detail: unknown }).detail
      msg = Array.isArray(d) ? d.map((x) => String(x)).join(', ') : String(d)
    } else if (typeof data === 'string') {
      msg = data.length > 500 ? `${data.slice(0, 500)}…` : data
    } else if (data && typeof data === 'object') {
      try {
        msg = JSON.stringify(data)
        if (msg.length > 600) {
          msg = `${msg.slice(0, 600)}…`
        }
      } catch {
        msg = err.message
      }
    }
    if (err.config?.url) {
      msg = `${msg} (${err.config.baseURL ?? ''}${err.config.url})`
    }
    return [st, msg].filter(Boolean).join(' — ')
  }
  if (err instanceof Error) {
    return err.message
  }
  if (err != null && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  if (err != null) {
    return String(err)
  }
  return ''
}

export default function ErrorAlert({
  message = 'Error al cargar los datos.',
  error,
  onRetry,
  className = '',
}: ErrorAlertProps) {
  const showDetail = shouldShowErrorDebug() && error != null
  const detail = showDetail ? formatErrorDebug(error) : ''

  return (
    <div className={`rounded-summa bg-summa-magenta/5 border border-summa-magenta/20 p-4 flex items-start gap-3 ${className}`}>
      <div className="w-8 h-8 rounded-full bg-summa-magenta/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-summa-magenta" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-summa-magenta font-medium">{message}</p>
        {showDetail && detail && (
          <p className="text-xs text-summa-ink-light font-mono mt-2 break-words whitespace-pre-wrap" role="status">
            {detail}
          </p>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 text-sm font-semibold text-summa-magenta underline hover:no-underline">
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
