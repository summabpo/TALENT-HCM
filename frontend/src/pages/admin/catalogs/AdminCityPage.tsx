import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminCitiesApi, adminStatesApi, adminCountriesApi } from '@/api/catalogs'
import { useAuth, useGlobalCatalogWriteAccess } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { AdminCity } from '@/types'

type FormValues = {
  name: string
  code: string
  country: string
  state_province: string
  is_active: boolean
}

export default function AdminCityPage() {
  const { user } = useAuth()
  const canWrite = useGlobalCatalogWriteAccess()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filterCountry, setFilterCountry] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminCity | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AdminCity | null>(null)

  const params: Record<string, string> = { page: String(page) }
  if (search) params.search = search
  if (filterState) params.state = filterState
  else if (filterCountry) params.country = filterCountry
  if (filterActive) params.is_active = filterActive

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-cities', page, search, filterCountry, filterState, filterActive],
    queryFn: () => adminCitiesApi.list(params),
  })

  const { data: countries } = useQuery({
    queryKey: ['admin-countries-all'],
    queryFn: () => adminCountriesApi.list({ page_size: '200', is_active: 'true' }),
  })

  const { data: statesForFilter } = useQuery({
    queryKey: ['admin-states-filter', filterCountry],
    queryFn: () =>
      adminStatesApi.list({ page_size: '200', is_active: 'true', country: filterCountry }),
    enabled: Boolean(filterCountry),
  })

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<FormValues>()
  const formCountry = useWatch({ control, name: 'country' })

  const { data: statesForForm } = useQuery({
    queryKey: ['admin-states-form', formCountry],
    queryFn: () =>
      adminStatesApi.list({ page_size: '200', is_active: 'true', country: formCountry }),
    enabled: Boolean(formCountry),
  })

  const stateMap = Object.fromEntries(
    (statesForFilter?.results ?? statesForForm?.results ?? []).map((s) => [s.id, s.name])
  )

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', code: '', country: filterCountry || '', state_province: filterState || '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: AdminCity) {
    setEditingItem(item)
    reset({
      name: item.name,
      code: item.code,
      state_province: String(item.state_province),
      country: '',
      is_active: item.is_active,
    })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingItem(null)
    reset()
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        code: values.code,
        state_province: Number(values.state_province),
        is_active: values.is_active,
      }
      return editingItem
        ? adminCitiesApi.update(editingItem.id, payload)
        : adminCitiesApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cities'] })
      qc.invalidateQueries({ queryKey: ['admin-catalog-count-cities'] })
      closeForm()
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (item: AdminCity) =>
      item.is_active ? adminCitiesApi.deactivate(item.id) : adminCitiesApi.activate(item.id),
    onSuccess: () => {
      setToggleTarget(null)
      qc.invalidateQueries({ queryKey: ['admin-cities'] })
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
      header: 'Ciudad',
      render: (row: AdminCity) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'code',
      header: 'Código',
      render: (row: AdminCity) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.code}</span>
      ),
    },
    {
      key: 'state_province',
      header: 'Departamento',
      render: (row: AdminCity) => (
        <span className="text-sm text-summa-ink-light">
          {row.state_province_name || stateMap[row.state_province] || `— (id ${row.state_province})`}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: AdminCity) => (
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
            render: (row: AdminCity) => (
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
          { label: 'Ciudades' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Ciudades / Municipios</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Municipios y ciudades disponibles en la plataforma
          </p>
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
            Nueva ciudad
          </button>
        )}
      </div>

      {error && <ErrorAlert message="Error al cargar las ciudades." error={error} onRetry={refetch} className="mb-4" />}

      {canWrite && formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar ciudad' : 'Nueva ciudad'}
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
                placeholder="Ej. Bogotá D.C."
                autoFocus
              />
              {errors.name && <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Código DANE</label>
              <input {...register('code')} className="input font-mono" placeholder="11001" maxLength={10} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">País</label>
              <select
                {...register('country')}
                className="input"
                onChange={(e) => {
                  register('country').onChange(e)
                  setValue('state_province', '')
                }}
              >
                <option value="">— Seleccionar país —</option>
                {(countries?.results ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Departamento <span className="text-summa-magenta">*</span>
              </label>
              <select
                {...register('state_province', { required: 'Requerido' })}
                className="input"
                disabled={!formCountry && !editingItem}
              >
                <option value="">— Seleccionar —</option>
                {(statesForForm?.results ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.state_province && (
                <p className="text-summa-magenta text-xs mt-1">{errors.state_province.message}</p>
              )}
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="rounded border-summa-border text-summa-navy" />
                <span className="text-sm font-semibold text-summa-ink">Activa</span>
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
            onChange={(e) => { setFilterCountry(e.target.value); setFilterState(''); setPage(1) }}
            className="input max-w-44"
          >
            <option value="">Todos los países</option>
            {(countries?.results ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterState}
            onChange={(e) => { setFilterState(e.target.value); setPage(1) }}
            className="input max-w-52"
            disabled={!filterCountry}
          >
            <option value="">Todos los departamentos</option>
            {(statesForFilter?.results ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={filterActive} onChange={(e) => { setFilterActive(e.target.value); setPage(1) }} className="input max-w-40">
            <option value="">Todos los estados</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </div>
        <DataTable
          columns={columns}
          data={data?.results ?? []}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay ciudades. Selecciona un departamento para filtrar."
          page={page}
          pageSize={50}
          total={data?.count}
          onPageChange={(p) => setPage(p)}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar ciudad..."
        />
      </div>

      <ConfirmDialog
        open={canWrite && !!toggleTarget}
        title={toggleTarget?.is_active ? 'Desactivar ciudad' : 'Activar ciudad'}
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
