import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { catalogPositionsApi, organizationalLevelsApi } from '@/api/catalogs'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { CatalogPosition } from '@/types'

type FormValues = {
  name: string
  level: string
  is_active: boolean
}

export default function PositionPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogPosition | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (filterActive) params.is_active = filterActive

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['catalog-positions', search, filterActive],
    queryFn: () => catalogPositionsApi.list(params),
  })

  const { data: orgLevels = [] } = useQuery({
    queryKey: ['catalog-org-levels'],
    queryFn: () => organizationalLevelsApi.list(),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', level: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(item: CatalogPosition) {
    setEditingItem(item)
    reset({ name: item.name, level: item.level, is_active: item.is_active })
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
        ? catalogPositionsApi.update(editingItem.id, {
            name: values.name,
            level: values.level,
            is_active: values.is_active,
          })
        : catalogPositionsApi.create({
            name: values.name,
            level: values.level,
            is_active: values.is_active,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-positions'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogPositionsApi.delete(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['catalog-positions'] })
    },
  })

  const levelMap = Object.fromEntries(orgLevels.map((l) => [l.id, l.name]))

  const columns = [
    {
      key: 'name',
      header: 'Cargo',
      render: (row: CatalogPosition) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'level',
      header: 'Nivel org.',
      render: (row: CatalogPosition) => (
        <span className="text-sm text-summa-ink-light">
          {levelMap[row.level] ?? '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: CatalogPosition) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: CatalogPosition) => (
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
          { label: 'Cargos' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Cargos</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Posiciones y roles de la organización
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cargo
        </button>
      </div>

      {error && <ErrorAlert message="Error al cargar los cargos." onRetry={refetch} className="mb-4" />}

      {formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar cargo' : 'Nuevo cargo'}
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
                Nombre del cargo <span className="text-summa-magenta">*</span>
              </label>
              <input
                {...register('name', { required: 'Requerido' })}
                className="input"
                placeholder="Ej. Analista de RRHH"
                autoFocus
              />
              {errors.name && (
                <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Nivel organizacional <span className="text-summa-magenta">*</span>
              </label>
              <select
                {...register('level', { required: 'Requerido' })}
                className="input"
              >
                <option value="">— Seleccionar —</option>
                {orgLevels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {errors.level && (
                <p className="text-summa-magenta text-xs mt-1">{errors.level.message}</p>
              )}
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
        <div className="flex gap-3 mb-4 flex-wrap">
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
          emptyMessage="No hay cargos registrados. Crea el primero."
          search={search}
          onSearchChange={(v) => setSearch(v)}
          searchPlaceholder="Buscar cargo..."
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar cargo"
        message="¿Eliminar este cargo? Los contratos que lo referencian pueden verse afectados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
