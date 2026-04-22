import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subCostCentersApi, costCentersApi } from '@/api/catalogs'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { SubCostCenter } from '@/types'

type FormValues = {
  name: string
  cost_center: string
  suffix: string
  is_active: boolean
}

export default function SubCostCenterPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [filterCostCenter, setFilterCostCenter] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SubCostCenter | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (filterActive) params.is_active = filterActive
  if (filterCostCenter) params.cost_center = filterCostCenter

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['catalog-sub-cost-centers', search, filterActive, filterCostCenter],
    queryFn: () => subCostCentersApi.list(params),
  })

  const { data: costCenters = [] } = useQuery({
    queryKey: ['catalog-cost-centers'],
    queryFn: () => costCentersApi.list({ is_active: 'true' }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', cost_center: filterCostCenter || '', suffix: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: SubCostCenter) {
    setEditingItem(item)
    reset({
      name: item.name,
      cost_center: item.cost_center,
      suffix: item.suffix,
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
    mutationFn: (values: FormValues) =>
      editingItem
        ? subCostCentersApi.update(editingItem.id, {
            name: values.name,
            cost_center: values.cost_center,
            suffix: values.suffix,
            is_active: values.is_active,
          })
        : subCostCentersApi.create({
            name: values.name,
            cost_center: values.cost_center,
            suffix: values.suffix,
            is_active: values.is_active,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-sub-cost-centers'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subCostCentersApi.delete(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['catalog-sub-cost-centers'] })
    },
  })

  const costCenterMap = Object.fromEntries(costCenters.map((c) => [c.id, c.name]))

  const columns = [
    {
      key: 'name',
      header: 'Sub-centro',
      render: (row: SubCostCenter) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'cost_center',
      header: 'Centro de costo',
      render: (row: SubCostCenter) => (
        <span className="text-sm text-summa-ink-light">
          {costCenterMap[row.cost_center] ?? '—'}
        </span>
      ),
    },
    {
      key: 'suffix',
      header: 'Sufijo',
      render: (row: SubCostCenter) => (
        <span className="font-mono text-xs text-summa-ink-light">
          {row.suffix || '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: SubCostCenter) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: SubCostCenter) => (
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
          { label: 'Sub-Centros de Costo' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Sub-Centros de Costo</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Divisiones de los centros de costo de la empresa
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo sub-centro
        </button>
      </div>

      {error && <ErrorAlert message="Error al cargar los sub-centros." onRetry={refetch} className="mb-4" />}

      {formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar sub-centro' : 'Nuevo sub-centro de costo'}
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
            className="grid grid-cols-1 sm:grid-cols-4 gap-4"
          >
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Nombre <span className="text-summa-magenta">*</span>
              </label>
              <input
                {...register('name', { required: 'Requerido' })}
                className="input"
                placeholder="Ej. Logística operativa"
                autoFocus
              />
              {errors.name && (
                <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Centro de costo <span className="text-summa-magenta">*</span>
              </label>
              <select
                {...register('cost_center', { required: 'Requerido' })}
                className="input"
              >
                <option value="">— Seleccionar —</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.cost_center && (
                <p className="text-summa-magenta text-xs mt-1">{errors.cost_center.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">Sufijo</label>
              <input
                {...register('suffix')}
                className="input font-mono"
                placeholder="01"
                maxLength={2}
              />
            </div>
            <div className="flex items-end gap-4 pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  className="rounded border-summa-border text-summa-navy"
                />
                <span className="text-sm font-semibold text-summa-ink">Activo</span>
              </label>
            </div>
            <div className="sm:col-span-4 flex gap-2">
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
        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={filterCostCenter}
            onChange={(e) => setFilterCostCenter(e.target.value)}
            className="input max-w-52"
          >
            <option value="">Todos los centros</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="input max-w-40"
          >
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <DataTable
          columns={columns}
          data={data}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay sub-centros de costo registrados. Crea el primero."
          search={search}
          onSearchChange={(v) => setSearch(v)}
          searchPlaceholder="Buscar sub-centro..."
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar sub-centro de costo"
        message="¿Eliminar este sub-centro de costo? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
