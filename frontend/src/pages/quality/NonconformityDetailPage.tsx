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

const STATUS_MAP: Record<string, { label: string; variant: 'magenta' | 'purple' | 'navy' | 'cyan' | 'green' | 'gray' }> = {
  open: { label: 'Abierta', variant: 'magenta' },
  investigating: { label: 'Investigando', variant: 'purple' },
  action_plan: { label: 'Plan de acción', variant: 'navy' },
  verification: { label: 'Verificación', variant: 'cyan' },
  closed: { label: 'Cerrada', variant: 'green' },
}

const SEVERITY_MAP: Record<string, { label: string; variant: 'magenta' | 'purple' | 'navy' }> = {
  critical: { label: 'Crítica', variant: 'magenta' },
  major: { label: 'Mayor', variant: 'purple' },
  minor: { label: 'Menor', variant: 'navy' },
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-summa-ink whitespace-pre-wrap">{value || '—'}</dd>
    </div>
  )
}

export default function NonconformityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showClose, setShowClose] = useState(false)

  const { data: nc, isLoading, error, refetch } = useQuery({
    queryKey: ['nonconformity', id],
    queryFn: () => qualityApi.nonconformity(id!),
    enabled: !!id,
  })

  const closeMutation = useMutation({
    mutationFn: () => qualityApi.updateNonconformity(id!, { status: 'closed' }),
    onSuccess: () => {
      setShowClose(false)
      qc.invalidateQueries({ queryKey: ['nonconformity', id] })
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error || !nc) return <ErrorAlert message="No se pudo cargar la no conformidad." onRetry={refetch} />

  const statusInfo = STATUS_MAP[nc.status] ?? { label: nc.status, variant: 'gray' as const }
  const severityInfo = SEVERITY_MAP[nc.severity] ?? { label: nc.severity, variant: 'navy' as const }

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Calidad', to: '/quality' },
        { label: 'No conformidades', to: '/quality/nonconformities' },
        { label: nc.title },
      ]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">{nc.title}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            <Badge variant={severityInfo.variant}>{severityInfo.label}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/quality/nonconformities/${id}/edit`)} className="btn-ghost">
            Editar
          </button>
          {nc.status !== 'closed' && (
            <button onClick={() => setShowClose(true)} className="btn-primary">
              Cerrar NC
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Información general" />
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label="Fuente" value={nc.source} />
            <InfoRow label="Responsable" value={nc.owner_name} />
            <InfoRow label="Fecha detección" value={nc.detected_date} />
            <InfoRow label="Fecha límite" value={nc.due_date} />
            {nc.closed_at && <InfoRow label="Fecha cierre" value={nc.closed_at.slice(0, 10)} />}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Descripción" />
          <p className="text-sm text-summa-ink whitespace-pre-wrap">{nc.description || '—'}</p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Análisis de causa raíz y acciones CAPA" />
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoRow label="Causa raíz" value={nc.root_cause} />
            <InfoRow label="Acción inmediata" value={nc.immediate_action} />
            <InfoRow label="Acción correctiva" value={nc.corrective_action} />
            <InfoRow label="Acción preventiva" value={nc.preventive_action} />
          </dl>
        </Card>
      </div>

      <ConfirmDialog
        open={showClose}
        title="Cerrar no conformidad"
        message={`¿Cerrar "${nc.title}"? Esta acción marcará la NC como cerrada.`}
        confirmLabel="Cerrar NC"
        loading={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
        onCancel={() => setShowClose(false)}
      />
    </div>
  )
}
