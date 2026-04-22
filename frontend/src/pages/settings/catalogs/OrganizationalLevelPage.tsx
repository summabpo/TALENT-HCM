import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationalLevelsApi } from '@/api/catalogs'
import Breadcrumb from '@/components/ui/Breadcrumb'
import DataTable from '@/components/ui/DataTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorAlert from '@/components/ui/ErrorAlert'
import type { OrganizationalLevel } from '@/types'

type FormValues = { name: string }

export default function OrganizationalLevelPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OrganizationalLevel | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['catalog-org-levels', search],
    queryFn: () => organizationalLevelsApi.list(search ? { search } : {}),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '' })
    setFormOpen(true)
  }

  function openEdit(item: OrganizationalLevel) {
    setEditingItem(item)
    reset({ name: item.name })
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
        ? organizationalLevelsApi.update(editingItem.id, { name: values.name })
        : organizationalLevelsApi.create({ name: values.name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-org-levels'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationalLevelsApi.delete(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['catalog-org-levels'] })
    },
  })

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row: OrganizationalLevel) => (
        <span className="font-semibold text-summa-ink">{row.name}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Creado',
      render: (row: OrganizationalLevel) => (
        <span className="text-xs text-summa-ink-light">{row.created_at.slice(0, 10)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row: OrganizationalLevel) => (
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
          { label: 'Niveles Organizacionales' },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Niveles Organizacionales</h1>
          <p className="text-sm text-summa-ink-light mt-1">
            Jerarquías de la estructura organizacional de la empresa
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo nivel
        </button>
      </div>

      {error && <ErrorAlert message="Error al cargar los niveles." onRetry={refetch} className="mb-4" />}

      {formOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-summa-ink">
              {editingItem ? 'Editar nivel' : 'Nuevo nivel organizacional'}
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
            className="flex gap-3 items-end flex-wrap"
          >
            <div className="flex-1 min-w-48">
              <label className="block text-sm font-semibold text-summa-ink mb-1">
                Nombre <span className="text-summa-magenta">*</span>
              </label>
              <input
                {...register('name', { required: 'Requerido' })}
                className="input"
                placeholder="Ej. Gerencia, Jefatura, Coordinación"
                autoFocus
              />
              {errors.name && (
                <p className="text-summa-magenta text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
            <div className="flex gap-2 pb-0.5">
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
        <DataTable
          columns={columns}
          data={data}
          keyField="id"
          loading={isLoading}
          error={null}
          onRetry={refetch}
          emptyMessage="No hay niveles organizacionales. Crea el primero."
          search={search}
          onSearchChange={(v) => setSearch(v)}
          searchPlaceholder="Buscar nivel..."
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar nivel"
        message="¿Eliminar este nivel organizacional? Los cargos asociados quedarán sin nivel. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
