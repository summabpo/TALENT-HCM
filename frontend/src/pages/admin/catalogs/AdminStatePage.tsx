import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminStatesApi, adminCountriesApi } from '@/api/catalogs'
import { useAuth, useGlobalCatalogWriteAccess } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { AdminStateProvince } from '@/types'

type FormValues = { name: string; code: string; country: string; is_active: boolean }

export default function AdminStatePage() {
  const { user } = useAuth()
  const canWrite = useGlobalCatalogWriteAccess()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filterCountry, setFilterCountry] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminStateProvince | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AdminStateProvince | null>(null)

  const params: Record<string, string> = { page: String(page) }
  if (search) params.search = search
  if (filterCountry) params.country = filterCountry
  if (filterActive) params.is_active = filterActive

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-states', page, search, filterCountry, filterActive],
    queryFn: () => adminStatesApi.list(params),
  })

  const { data: countries } = useQuery({
    queryKey: ['admin-countries-all'],
    queryFn: () => adminCountriesApi.list({ page_size: '200', is_active: 'true' }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', code: '', country: filterCountry || '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: AdminStateProvince) {
    setEditingItem(item)
    reset({ name: item.name, code: item.code, country: String(item.country), is_active: item.is_active })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingItem(null)
    reset()
  }

  const countryMap = Object.fromEntries(
    (countries?.results ?? []).map((c) => [c.id, c.name])
  )

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        code: values.code,
        country: Number(values.country),
        is_active: values.is_active,
      }
      return editingItem
        ? adminStatesApi.update(editingItem.id, payload)
        : adminStatesApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-states'] })
      qc.invalidateQueries({ queryKey: ['admin-catalog-count-states'] })
      closeForm()
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (item: AdminStateProvince) =>
      item.is_active ? adminStatesApi.deactivate(item.id) : adminStatesApi.activate(item.id),
    onSuccess: () => {
      setToggleTarget(null)
      qc.invalidateQueries({ queryKey: ['admin-states'] })
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
      header: 'Departamento',
      render: (row: AdminStateProvince) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'code',
      header: 'Código',
      render: (row: AdminStateProvince) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.code}</span>
      ),
    },
    {
      key: 'country',
      header: 'País',
      render: (row: AdminStateProvince) => (
        <span className="text-sm text-summa-ink-light">{countryMap[row.country] ?? row.country}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: AdminStateProvince) => (
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
            render: (row: AdminStateProvince) => (
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
          { label: 'Departamentos' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Departamentos / Estados</h1>
          <p className="text-sm text-summa-ink-light mt-1">Divisiones administrativas por país</p>
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
            Nuevo departamento
          </button>
        )}
      </div>

      {error && <ErrorAlert message="Error al cargar los departamentos." error={error} onRetry={refetch} className="mb-4" />}

      {canWrite && formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar departamento' : 'Nuevo departamento'}
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
                placeholder="Ej. Cundinamarca"
                autoFocus
              />
              {errors.name && <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Código</label>
              <input {...register('code')} className="input font-mono" placeholder="11" maxLength={10} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                País <span className="text-summa-magenta">*</span>
              </label>
              <select {...register('country', { required: 'Requerido' })} className="input">
                <option value="">— Seleccionar —</option>
                {(countries?.results ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.country && <p className="text-summa-magenta text-xs mt-1">{errors.country.message}</p>}
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
        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={filterCountry}
            onChange={(e) => { setFilterCountry(e.target.value); setPage(1) }}
            className="input max-w-48"
          >
            <option value="">Todos los países</option>
            {(countries?.results ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
          emptyMessage="No hay departamentos registrados."
          page={page}
          pageSize={50}
          total={data?.count}
          onPageChange={(p) => setPage(p)}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar departamento..."
        />
      </div>

      <ConfirmDialog
        open={canWrite && !!toggleTarget}
        title={toggleTarget?.is_active ? 'Desactivar departamento' : 'Activar departamento'}
        message={
          toggleTarget?.is_active
            ? `¿Desactivar "${toggleTarget?.name}"? Sus ciudades dejarán de aparecer en los formularios.`
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
