import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { qualityApi } from '@/api/quality'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { QualityDocument } from '@/types'

const DOC_STATUS: Record<string, { label: string; variant: 'gray' | 'cyan' | 'green' | 'magenta' }> = {
  draft: { label: 'Borrador', variant: 'gray' },
  under_review: { label: 'En revisión', variant: 'cyan' },
  approved: { label: 'Aprobado', variant: 'green' },
  obsolete: { label: 'Obsoleto', variant: 'magenta' },
}

export default function QualityProcessDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useQueryClient()
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [approveDocId, setApproveDocId] = useState<string | null>(null)
  const [approvedBy, setApprovedBy] = useState('')

  const { data: process, isLoading, error, refetch } = useQuery({
    queryKey: ['quality-process', id],
    queryFn: () => qualityApi.process(id!),
    enabled: !!id,
  })

  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ['quality-documents', id],
    queryFn: () => qualityApi.documents(id!),
    enabled: !!id,
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => qualityApi.deleteDocument(id!, docId),
    onSuccess: () => { setDeleteDocId(null); refetchDocs() },
  })

  const approveMutation = useMutation({
    mutationFn: (docId: string) => qualityApi.approveDocument(id!, docId, { approved_by: approvedBy }),
    onSuccess: () => { setApproveDocId(null); setApprovedBy(''); refetchDocs() },
  })

  if (isLoading) return <LoadingSpinner />
  if (error || !process) return <ErrorAlert message="No se pudo cargar el proceso." onRetry={refetch} />

  const docs: QualityDocument[] = docsData?.results ?? []
  const drafts = docs.filter(d => d.status === 'draft' || d.status === 'under_review')
  const approved = docs.filter(d => d.status === 'approved')
  const archived = docs.filter(d => d.status === 'obsolete')

  function DocTable({ items, showApprove }: { items: QualityDocument[]; showApprove?: boolean }) {
    if (items.length === 0) return <p className="text-sm text-summa-ink-light py-2">Sin documentos.</p>
    return (
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Código</th>
              <th>Versión</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((doc) => {
              const s = DOC_STATUS[doc.status] ?? { label: doc.status, variant: 'gray' as const }
              return (
                <tr key={doc.id}>
                  <td className="font-semibold text-summa-ink">{doc.title}</td>
                  <td className="font-mono text-xs text-summa-ink-light">{doc.document_code}</td>
                  <td className="text-summa-ink-light">{doc.version}</td>
                  <td><Badge variant={s.variant}>{s.label}</Badge></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {doc.file && (
                        <a href={doc.file} target="_blank" rel="noreferrer" className="text-xs text-summa-navy hover:text-summa-magenta font-semibold">
                          Ver →
                        </a>
                      )}
                      {showApprove && (
                        <button
                          onClick={() => setApproveDocId(doc.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                        >
                          Aprobar
                        </button>
                      )}
                      {(doc.status === 'draft' || doc.status === 'under_review') && (
                        <button
                          onClick={() => setDeleteDocId(doc.id)}
                          className="text-xs text-summa-magenta hover:underline font-semibold"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Calidad', to: '/quality' },
        { label: 'Procesos', to: '/quality/processes' },
        { label: process.name },
      ]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">{process.name}</h1>
          {process.process_type && <p className="text-sm text-summa-ink-light mt-1">Tipo: {process.process_type}</p>}
        </div>
        <div className="flex gap-2">
          <Badge variant={process.is_active ? 'green' : 'gray'}>
            {process.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
          <button onClick={() => navigate(`/quality/processes/${id}/edit`)} className="btn-ghost">
            Editar
          </button>
        </div>
      </div>

      {process.description && (
        <Card>
          <p className="text-sm text-summa-ink">{process.description}</p>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Borradores y revisión"
          action={
            <button
              onClick={() => navigate(`/quality/processes/${id}/documents/create`)}
              className="btn-secondary btn-sm"
            >
              + Nuevo documento
            </button>
          }
        />
        <DocTable items={drafts} showApprove />
      </Card>

      <Card>
        <CardHeader title="Documentos aprobados" />
        <DocTable items={approved} />
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader title="Archivados / Obsoletos" />
          <DocTable items={archived} />
        </Card>
      )}

      {approveDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-summa-ink/40 backdrop-blur-sm" onClick={() => setApproveDocId(null)} />
          <div className="relative bg-white rounded-summa-lg shadow-summa-lg p-6 w-full max-w-md mx-4 border-t-4 border-summa-navy">
            <h3 className="font-semibold text-summa-ink mb-4">Aprobar documento</h3>
            <div>
              <label className="text-sm font-semibold text-summa-ink block mb-1">Aprobado por *</label>
              <input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                className="input"
                placeholder="Nombre o cargo"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setApproveDocId(null)} className="btn-ghost">Cancelar</button>
              <button
                disabled={!approvedBy || approveMutation.isPending}
                onClick={() => approveMutation.mutate(approveDocId)}
                className="btn-primary disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Aprobando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteDocId}
        title="Eliminar documento"
        message="¿Eliminar este documento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteDocMutation.isPending}
        onConfirm={() => deleteDocId && deleteDocMutation.mutate(deleteDocId)}
        onCancel={() => setDeleteDocId(null)}
      />
    </div>
  )
}
