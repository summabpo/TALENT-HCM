import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { costCentersApi } from '@/api/catalogs'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { CostCenter } from '@/types'

type FormValues = {
  name: string
  accounting_group: string
  suffix: string
  is_active: boolean
}

export default function CostCenterPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CostCenter | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (filterActive) params.is_active = filterActive

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['catalog-cost-centers', search, filterActive],
    queryFn: () => costCentersApi.list(params),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', accounting_group: '', suffix: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: CostCenter) {
    setEditingItem(item)
    reset({
      name: item.name,
      accounting_group: item.accounting_group,
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
        ? costCentersApi.update(editingItem.id, {
            name: values.name,
            accounting_group: values.accounting_group,
            suffix: values.suffix,
            is_active: values.is_active,
          })
        : costCentersApi.create({
            name: values.name,
            accounting_group: values.accounting_group,
            suffix: values.suffix,
            is_active: values.is_active,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-cost-centers'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => costCentersApi.delete(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['catalog-cost-centers'] })
    },
  })

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row: CostCenter) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'accounting_group',
      header: 'Grupo contable',
      render: (row: CostCenter) => (
        <span className="font-mono text-xs text-summa-ink-light">
          {row.accounting_group || '—'}
        </span>
      ),
    },
    {
      key: 'suffix',
      header: 'Sufijo',
      render: (row: CostCenter) => (
        <span className="font-mono text-xs text-summa-ink-light">
          {row.suffix || '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: CostCenter) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: CostCenter) => (
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
          { label: 'Centros de Costo' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Centros de Costo</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Unidades de costeo y agrupación contable de la empresa
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo centro
        </button>
      </div>

      {error && <ErrorAlert message="Error al cargar los centros de costo." onRetry={refetch} className="mb-4" />}

      {formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar centro de costo' : 'Nuevo centro de costo'}
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
                placeholder="Ej. Administración"
                autoFocus
              />
              {errors.name && (
                <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Grupo contable
              </label>
              <input
                {...register('accounting_group')}
                className="input font-mono"
                placeholder="0001"
                maxLength={4}
              />
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
        <div className="flex gap-3 mb-4">
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
          emptyMessage="No hay centros de costo registrados. Crea el primero."
          search={search}
          onSearchChange={(v) => setSearch(v)}
          searchPlaceholder="Buscar centro de costo..."
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar centro de costo"
        message="¿Eliminar este centro de costo? Los sub-centros asociados también se eliminarán. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
