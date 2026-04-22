import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workLocationsApi, catalogsApi } from '@/api/catalogs'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { WorkLocation } from '@/types'

type FormValues = {
  name: string
  compensation_fund: string
  is_active: boolean
}

export default function WorkLocationPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WorkLocation | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (filterActive) params.is_active = filterActive

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['catalog-work-locations', search, filterActive],
    queryFn: () => workLocationsApi.list(params),
  })

  const { data: ccfEntities = [] } = useQuery({
    queryKey: ['catalog-ccf'],
    queryFn: () => catalogsApi.socialSecurityByType('CCF'),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', compensation_fund: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: WorkLocation) {
    setEditingItem(item)
    reset({
      name: item.name,
      compensation_fund: item.compensation_fund != null ? String(item.compensation_fund) : '',
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
      const payload: Record<string, unknown> = {
        name: values.name,
        is_active: values.is_active,
        compensation_fund: values.compensation_fund ? Number(values.compensation_fund) : null,
      }
      return editingItem
        ? workLocationsApi.update(editingItem.id, payload)
        : workLocationsApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-work-locations'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workLocationsApi.delete(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['catalog-work-locations'] })
    },
  })

  const ccfMap = Object.fromEntries(ccfEntities.map((e) => [e.id, e.name]))

  const columns = [
    {
      key: 'name',
      header: 'Sede / Ubicación',
      render: (row: WorkLocation) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'compensation_fund',
      header: 'Caja de compensación',
      render: (row: WorkLocation) => (
        <span className="text-sm text-summa-ink-light">
          {row.compensation_fund ? ccfMap[row.compensation_fund] ?? '—' : '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: WorkLocation) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: WorkLocation) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(row)} className="btn-ghost btn-sm">Editar</button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="btn-sm inline-flex items-center text-summa-magenta border border-summa-magenta/30 hover:bg-summa-magenta hover:text-white rounded-summa px-3 py-1.5 text-xs font-semibold transition-all"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <Breadcrumb
        items={[
          { label: 'Configuración' },
          { label: 'Catálogos' },
          { label: 'Sedes / Ubicaciones' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Sedes / Ubicaciones</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Sedes físicas y ubicaciones de operación de la empresa
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva sede
        </button>
      </div>

      {error && <ErrorAlert message="Error al cargar las sedes." onRetry={refetch} className="mb-4" />}

      {formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar sede' : 'Nueva sede / ubicación'}
            </h2>
            <button
              onClick={closeForm}
              className="text-summa-ink-light hover:text-summa-ink transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {saveMutation.error && (
            <ErrorAlert message="Error al guardar. Revisa los datos." className="mb-3" />
          )}
          <form
            onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Nombre de la sede <span className="text-summa-magenta">*</span>
              </label>
              <input
                {...register('name', { required: 'Requerido' })}
                className="input"
                placeholder="Ej. Sede principal Bogotá"
                autoFocus
              />
              {errors.name && (
                <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Caja de compensación (CCF)
              </label>
              <select {...register('compensation_fund')} className="input">
                <option value="">— Sin CCF —</option>
                {ccfEntities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-4 pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  className="rounded border-summa-border text-summa-navy"
                />
                <span className="text-sm font-semibold text-summa-ink">Activa</span>
              </label>
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="btn-primary btn-sm"
              >
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={closeForm} className="btn-ghost btn-sm">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-4">
        <div className="flex gap-3 mb-4">
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="input max-w-40"
          >
            <option value="">Todos los estados</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </div>
        <DataTable
          columns={columns}
          data={data}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay sedes registradas. Crea la primera."
          search={search}
          onSearchChange={(v) => setSearch(v)}
          searchPlaceholder="Buscar sede..."
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar sede"
        message="¿Eliminar esta sede? Los centros de trabajo asociados pueden verse afectados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
