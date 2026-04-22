import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminCountriesApi } from '@/api/catalogs'
import { useAuth, useGlobalCatalogWriteAccess } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { AdminCountry } from '@/types'

type FormValues = { name: string; iso_code: string; is_active: boolean }

export default function AdminCountryPage() {
  const { user } = useAuth()
  const canWrite = useGlobalCatalogWriteAccess()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filterActive, setFilterActive] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminCountry | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AdminCountry | null>(null)

  const params: Record<string, string> = { page: String(page) }
  if (search) params.search = search
  if (filterActive) params.is_active = filterActive

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-countries', page, search, filterActive],
    queryFn: () => adminCountriesApi.list(params),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', iso_code: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: AdminCountry) {
    setEditingItem(item)
    reset({ name: item.name, iso_code: item.iso_code, is_active: item.is_active })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingItem(null)
    reset()
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      editingItem
        ? adminCountriesApi.update(editingItem.id, {
            name: values.name,
            iso_code: values.iso_code,
            is_active: values.is_active,
          })
        : adminCountriesApi.create({
            name: values.name,
            iso_code: values.iso_code,
            is_active: values.is_active,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-countries'] })
      qc.invalidateQueries({ queryKey: ['admin-catalog-count-countries'] })
      closeForm()
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (item: AdminCountry) =>
      item.is_active
        ? adminCountriesApi.deactivate(item.id)
        : adminCountriesApi.activate(item.id),
    onSuccess: () => {
      setToggleTarget(null)
      qc.invalidateQueries({ queryKey: ['admin-countries'] })
    },
  })

  if (!user?.is_staff) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-lg font-bold text-summa-ink">Acceso restringido</h2>
        <p className="text-sm text-summa-ink-light">Solo los administradores pueden gestionar catálogos globales.</p>
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      header: 'País',
      render: (row: AdminCountry) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'iso_code',
      header: 'ISO',
      render: (row: AdminCountry) => (
        <span className="font-mono text-xs bg-summa-surface-dark px-1.5 py-0.5 rounded text-summa-ink-light">
          {row.iso_code || '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: AdminCountry) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row: AdminCountry) => (
              <div className="flex justify-end gap-1">
                <button type="button" onClick={() => openEdit(row)} className="btn-ghost btn-sm">
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setToggleTarget(row)}
                  className={`btn-sm inline-flex items-center rounded-summa px-3 py-1.5 text-xs font-semibold transition-all border ${
                    row.is_active
                      ? 'text-amber-700 border-amber-300 hover:bg-amber-600 hover:text-white hover:border-amber-600'
                      : 'text-emerald-700 border-emerald-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'
                  }`}
                >
                  {row.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="animate-fade-in">
      <Breadcrumb
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Catálogos', to: '/admin/catalogs' },
          { label: 'Países' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Países</h1>
          <p className="text-sm text-summa-ink-light mt-1">Países disponibles en la plataforma</p>
          {!canWrite && (
            <p className="text-xs text-summa-ink-light mt-2 max-w-xl">
              Solo lectura. Crear, editar o desactivar registros requiere cuenta de superusuario de plataforma.
            </p>
          )}
        </div>
        {canWrite && (
          <button type="button" onClick={openCreate} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo país
          </button>
        )}
      </div>

      {error && <ErrorAlert message="Error al cargar los países." error={error} onRetry={refetch} className="mb-4" />}

      {canWrite && formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar país' : 'Nuevo país'}
            </h2>
            <button onClick={closeForm} className="text-summa-ink-light hover:text-summa-ink transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {saveMutation.error && <ErrorAlert message="Error al guardar. Revisa los datos." error={saveMutation.error} className="mb-3" />}
          <form
            onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4"
          >
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Nombre <span className="text-summa-magenta">*</span>
              </label>
              <input
                {...register('name', { required: 'Requerido' })}
                className="input"
                placeholder="Ej. Colombia"
                autoFocus
              />
              {errors.name && <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Código ISO</label>
              <input
                {...register('iso_code')}
                className="input font-mono uppercase"
                placeholder="CO"
                maxLength={3}
              />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="rounded border-summa-border text-summa-navy" />
                <span className="text-sm font-semibold text-summa-ink">Activo</span>
              </label>
            </div>
            <div className="sm:col-span-4 flex gap-2">
              <button type="submit" disabled={saveMutation.isPending} className="btn-primary btn-sm">
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={closeForm} className="btn-ghost btn-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-4">
        <div className="flex gap-3 mb-4">
          <select value={filterActive} onChange={(e) => { setFilterActive(e.target.value); setPage(1) }} className="input max-w-40">
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <DataTable
          columns={columns}
          data={data?.results ?? []}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay países registrados."
          page={page}
          pageSize={50}
          total={data?.count}
          onPageChange={(p) => setPage(p)}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar país..."
        />
      </div>

      <ConfirmDialog
        open={canWrite && !!toggleTarget}
        title={toggleTarget?.is_active ? 'Desactivar país' : 'Activar país'}
        message={
          toggleTarget?.is_active
            ? `¿Desactivar "${toggleTarget?.name}"? No aparecerá en los formularios de los tenants.`
            : `¿Activar "${toggleTarget?.name}"?`
        }
        confirmLabel={toggleTarget?.is_active ? 'Desactivar' : 'Activar'}
        danger={toggleTarget?.is_active}
        loading={toggleMutation.isPending}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget)}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  )
}
