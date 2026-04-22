import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { personnelApi } from '@/api/personnel'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Contract, EmployeeDocument } from '@/types'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-summa-ink">{value || '—'}</dd>
    </div>
  )
}

const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  on_leave: 'En licencia o ausencia',
  terminated: 'Retirado',
}

const CONTRACT_STATUS: Record<string, { label: string; variant: 'green' | 'purple' | 'gray' | 'magenta' }> = {
  active:     { label: 'Activo',     variant: 'green'   },
  terminated: { label: 'Terminado',  variant: 'magenta' },
  suspended:  { label: 'Suspendido', variant: 'purple'  },
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [showUpload, setShowUpload]   = useState(false)
  const [uploadFile, setUploadFile]   = useState<File | null>(null)
  const [uploadType, setUploadType]   = useState('')
  const [uploadTitle, setUploadTitle] = useState('')

  const { data: employee, isLoading, error, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => personnelApi.employee(id!),
    enabled: !!id,
  })
  const { data: contracts } = useQuery({
    queryKey: ['contracts', id],
    queryFn: () => personnelApi.contracts(id!),
    enabled: !!id,
  })
  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => personnelApi.documents(id!),
    enabled: !!id,
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => personnelApi.deleteDocument(id!, docId),
    onSuccess: () => { setDeleteDocId(null); refetchDocs() },
  })
  const uploadMutation = useMutation({
    mutationFn: (fd: FormData) => personnelApi.uploadDocument(id!, fd),
    onSuccess: () => { setShowUpload(false); setUploadFile(null); setUploadTitle(''); setUploadType(''); refetchDocs() },
  })

  if (isLoading) return <LoadingSpinner />
  if (error || !employee) return <ErrorAlert message="No se pudo cargar el empleado." onRetry={refetch} />

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) return
    const fd = new FormData()
    fd.append('file', uploadFile)
    fd.append('title', uploadTitle)
    fd.append('document_type', uploadType)
    uploadMutation.mutate(fd)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[{ label: 'Personal', to: '/personnel' }, { label: 'Empleados', to: '/personnel/employees' }, { label: employee.full_name }]} />

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-summa-gradient flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {employee.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div>
            <h1 className="page-title">{employee.full_name}</h1>
            <p className="text-sm text-summa-ink-light mt-0.5">
              N° {employee.employee_number || 'Sin asignar'} · {employee.email}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/personnel/employees/${id}/onboarding`} className="btn-ghost">Onboarding</Link>
          <button onClick={() => navigate(`/personnel/employees/${id}/edit`)} className="btn-primary">
            Editar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Información personal" />
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow
              label="Documento"
              value={`${employee.document_type.code} ${employee.document_number}`}
            />
            <InfoRow label="Correo corp." value={employee.email} />
            <InfoRow label="Correo personal" value={employee.personal_email} />
            <InfoRow label="Celular" value={employee.cell_phone} />
            <InfoRow label="Género" value={employee.gender} />
            <InfoRow label="Nacimiento" value={employee.date_of_birth} />
            <InfoRow label="Estado civil" value={employee.marital_status} />
            <InfoRow label="Estrato" value={employee.socioeconomic_stratum != null ? String(employee.socioeconomic_stratum) : null} />
            <InfoRow label="Grupo sang." value={employee.blood_type} />
            <InfoRow label="Educación" value={employee.education_level} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Información laboral" />
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label="Estado" value={EMPLOYEE_STATUS_LABEL[employee.status] ?? employee.status} />
            <InfoRow label="N° empleado" value={employee.employee_number} />
            <InfoRow label="Dirección" value={employee.address} />
            <InfoRow label="Profesión" value={employee.profession?.name} />
            <InfoRow label="Contacto emergencia" value={employee.emergency_contact_name} />
            <InfoRow label="Tel. emergencia" value={employee.emergency_contact_phone} />
          </dl>
        </Card>
      </div>

      {/* Contracts */}
      <Card>
        <CardHeader
          title="Contratos"
          action={
            <Link to={`/personnel/employees/${id}/contracts/create`} className="btn-secondary btn-sm">
              + Nuevo
            </Link>
          }
        />
        {!contracts || contracts.length === 0 ? (
          <p className="text-sm text-summa-ink-light">Sin contratos registrados.</p>
        ) : (
          <div className="overflow-x-auto rounded-summa border border-summa-border">
            <table className="data-table">
              <thead><tr>
                <th>Tipo</th><th>Cargo</th><th>Salario</th><th>Inicio</th><th>Estado</th><th />
              </tr></thead>
              <tbody>
                {(contracts as Contract[]).map((c) => {
                  const s = CONTRACT_STATUS[c.contract_status] ?? { label: c.contract_status, variant: 'gray' as const }
                  return (
                    <tr key={c.id}>
                      <td>{c.contract_type_name ?? '—'}</td>
                      <td>{c.position_name ?? '—'}</td>
                      <td className="font-semibold tabular-nums">${Number(c.salary).toLocaleString('es-CO')}</td>
                      <td>{c.start_date}</td>
                      <td><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="text-right">
                        <Link to={`/personnel/employees/${id}/contracts/${c.id}`} className="text-xs text-summa-navy hover:text-summa-magenta font-semibold">
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader
          title="Documentos"
          action={
            <button onClick={() => setShowUpload(true)} className="btn-secondary btn-sm">
              + Subir
            </button>
          }
        />
        {showUpload && (
          <form onSubmit={handleUpload} className="mb-4 p-4 bg-summa-surface rounded-summa border border-summa-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-summa-ink block mb-1">Título</label>
                <input required value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="input" />
              </div>
              <div>
                <label className="text-xs font-semibold text-summa-ink block mb-1">Tipo</label>
                <input value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="input" placeholder="ej. cédula, diploma..." />
              </div>
            </div>
            <input required type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className="text-sm text-summa-ink" />
            <div className="flex gap-2">
              <button type="submit" disabled={uploadMutation.isPending} className="btn-primary btn-sm">
                {uploadMutation.isPending ? 'Subiendo...' : 'Subir'}
              </button>
              <button type="button" onClick={() => setShowUpload(false)} className="btn-ghost btn-sm">Cancelar</button>
            </div>
          </form>
        )}

        {!documents || documents.length === 0 ? (
          <p className="text-sm text-summa-ink-light">Sin documentos.</p>
        ) : (
          <ul className="divide-y divide-summa-border">
            {(documents as EmployeeDocument[]).map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-summa-ink">{doc.title}</p>
                  <p className="text-xs text-summa-ink-light">{doc.document_type} · {doc.created_at.slice(0, 10)}</p>
                </div>
                <div className="flex gap-3">
                  {doc.file && (
                    <a href={doc.file} target="_blank" rel="noreferrer" className="text-xs font-semibold text-summa-navy hover:text-summa-magenta">
                      Descargar
                    </a>
                  )}
                  <button onClick={() => setDeleteDocId(doc.id)} className="text-xs font-semibold text-summa-magenta hover:underline">
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteDocId} title="Eliminar documento" message="¿Eliminar este documento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar" danger loading={deleteDocMutation.isPending}
        onConfirm={() => deleteDocId && deleteDocMutation.mutate(deleteDocId)}
        onCancel={() => setDeleteDocId(null)}
      />
    </div>
  )
}
