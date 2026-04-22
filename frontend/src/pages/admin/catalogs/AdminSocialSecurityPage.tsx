import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminSocialSecurityApi } from '@/api/catalogs'
import { useAuth, useGlobalCatalogWriteAccess } from '@/contexts/AuthContext'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { AdminSocialSecurityEntity } from '@/types'

const ENTITY_TYPES = [
  { value: 'EPS', label: 'EPS' },
  { value: 'AFP', label: 'AFP — Fondo de Pensiones' },
  { value: 'ARL', label: 'ARL' },
  { value: 'CCF', label: 'CCF — Caja de Compensación' },
  { value: 'CESANTIAS', label: 'Fondo de Cesantías' },
]

type FormValues = {
  code: string
  nit: string
  name: string
  entity_type: string
  sgp_code: string
  is_active: boolean
}

export default function AdminSocialSecurityPage() {
  const { user } = useAuth()
  const canWrite = useGlobalCatalogWriteAccess()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminSocialSecurityEntity | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AdminSocialSecurityEntity | null>(null)

  const params: Record<string, string> = { page: String(page) }
  if (search) params.search = search
  if (filterType) params.type = filterType
  if (filterActive) params.is_active = filterActive

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-social', page, search, filterType, filterActive],
    queryFn: () => adminSocialSecurityApi.list(params),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ code: '', nit: '', name: '', entity_type: filterType || '', sgp_code: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: AdminSocialSecurityEntity) {
    setEditingItem(item)
    reset({
      code: item.code,
      nit: item.nit,
      name: item.name,
      entity_type: item.entity_type,
      sgp_code: item.sgp_code,
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
        code: values.code,
        nit: values.nit,
        name: values.name,
        entity_type: values.entity_type,
        sgp_code: values.sgp_code,
        is_active: values.is_active,
      }
      return editingItem
        ? adminSocialSecurityApi.update(editingItem.id, payload)
        : adminSocialSecurityApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-social'] })
      qc.invalidateQueries({ queryKey: ['admin-catalog-count-social'] })
      closeForm()
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (item: AdminSocialSecurityEntity) =>
      item.is_active
        ? adminSocialSecurityApi.deactivate(item.id)
        : adminSocialSecurityApi.activate(item.id),
    onSuccess: () => {
      setToggleTarget(null)
      qc.invalidateQueries({ queryKey: ['admin-social'] })
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

  const typeColors: Record<string, string> = {
    EPS: 'bg-blue-100 text-blue-700',
    AFP: 'bg-violet-100 text-violet-700',
    ARL: 'bg-orange-100 text-orange-700',
    CCF: 'bg-teal-100 text-teal-700',
    CESANTIAS: 'bg-pink-100 text-pink-700',
  }

  const columns = [
    {
      key: 'entity_type',
      header: 'Tipo',
      render: (row: AdminSocialSecurityEntity) => (
        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${typeColors[row.entity_type] ?? 'bg-gray-100 text-gray-700'}`}>
          {row.entity_type}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Entidad',
      render: (row: AdminSocialSecurityEntity) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'code',
      header: 'Código',
      render: (row: AdminSocialSecurityEntity) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.code}</span>
      ),
    },
    {
      key: 'nit',
      header: 'NIT',
      render: (row: AdminSocialSecurityEntity) => (
        <span className="font-mono text-xs text-summa-ink-light">{row.nit}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: AdminSocialSecurityEntity) => (
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
            render: (row: AdminSocialSecurityEntity) => (
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
          { label: 'Seguridad Social' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Entidades de Seguridad Social</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            EPS, AFP, ARL, Cajas de compensación y fondos de cesantías
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
            Nueva entidad
          </button>
        )}
      </div>

      {error && <ErrorAlert message="Error al cargar las entidades." error={error} onRetry={refetch} className="mb-4" />}

      {canWrite && formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar entidad' : 'Nueva entidad de seguridad social'}
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
                placeholder="Ej. Nueva EPS S.A.S."
                autoFocus
              />
              {errors.name && <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Tipo <span className="text-summa-magenta">*</span>
              </label>
              <select {...register('entity_type', { required: 'Requerido' })} className="input">
                <option value="">— Seleccionar —</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {errors.entity_type && <p className="text-summa-magenta text-xs mt-1">{errors.entity_type.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Código</label>
              <input {...register('code')} className="input font-mono" placeholder="EPS037" maxLength={9} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">NIT</label>
              <input {...register('nit')} className="input font-mono" placeholder="900156264-1" maxLength={12} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Código SGP</label>
              <input {...register('sgp_code')} className="input font-mono" placeholder="" maxLength={10} />
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
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
            className="input max-w-56"
          >
            <option value="">Todos los tipos</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
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
          emptyMessage="No hay entidades de seguridad social registradas."
          page={page}
          pageSize={50}
          total={data?.count}
          onPageChange={(p) => setPage(p)}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar entidad..."
        />
      </div>

      <ConfirmDialog
        open={canWrite && !!toggleTarget}
        title={toggleTarget?.is_active ? 'Desactivar entidad' : 'Activar entidad'}
        message={
          toggleTarget?.is_active
            ? `¿Desactivar "${toggleTarget?.name}"? No estará disponible en los formularios de los tenants.`
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
