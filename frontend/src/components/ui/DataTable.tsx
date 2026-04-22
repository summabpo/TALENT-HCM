import LoadingSpinner from './LoadingSpinner'
import ErrorAlert from './ErrorAlert'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyMessage?: string
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
}

export default function DataTable<T>({
  columns, data, keyField,
  loading, error, onRetry,
  emptyMessage = 'No hay registros.',
  page = 1, pageSize = 20, total, onPageChange,
  search, onSearchChange, searchPlaceholder = 'Buscar...',
}: DataTableProps<T>) {
  const totalPages = total !== undefined ? Math.ceil(total / pageSize) : 1

  return (
    <div className="flex flex-col gap-4">
      {onSearchChange && (
        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-summa-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="input pl-9"
          />
        </div>
      )}

      {error ? (
        <ErrorAlert message={error} onRetry={onRetry} />
      ) : loading ? (
        <LoadingSpinner />
      ) : data.length === 0 ? (
        <div className="text-center py-14">
          <div className="w-12 h-12 rounded-full bg-summa-surface-dark flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-summa-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-summa-ink-light">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-summa border border-summa-border">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={col.className}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={String(row[keyField])}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {onPageChange && total !== undefined && totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-summa-ink-light pt-1">
              <span className="font-medium">{total} registro{total !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-summa border border-summa-border hover:border-summa-navy hover:text-summa-navy disabled:opacity-40 transition-colors"
                >
                  ‹
                </button>
                <span className="px-2 font-semibold text-summa-ink">{page} / {totalPages}</span>
                <button
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-summa border border-summa-border hover:border-summa-navy hover:text-summa-navy disabled:opacity-40 transition-colors"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
