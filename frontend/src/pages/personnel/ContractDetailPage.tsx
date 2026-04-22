import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { personnelApi } from '@/api/personnel'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import { Card, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useState } from 'react'

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'boolean'
      ? value ? 'Sí' : 'No'
      : String(value)
  return (
    <div>
      <dt className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-summa-ink">{display}</dd>
    </div>
  )
}

const STATUS_MAP: Record<string, { label: string; variant: 'green' | 'purple' | 'magenta' | 'gray' }> = {
  active: { label: 'Activo', variant: 'green' },
  terminated: { label: 'Terminado', variant: 'magenta' },
  suspended: { label: 'Suspendido', variant: 'purple' },
}

export default function ContractDetailPage() {
  const { id: employeeId, contractId } = useParams<{ id: string; contractId: string }>()
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)

  const { data: employee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => personnelApi.employee(employeeId!),
    enabled: !!employeeId,
  })

  const { data: contract, isLoading, error, refetch } = useQuery({
    queryKey: ['contract', employeeId, contractId],
    queryFn: () => personnelApi.contract(employeeId!, contractId!),
    enabled: !!employeeId && !!contractId,
  })

  const deleteMutation = useMutation({
    mutationFn: () => personnelApi.deleteContract(employeeId!, contractId!),
    onSuccess: () => navigate(`/personnel/employees/${employeeId}`),
  })

  if (isLoading) return <LoadingSpinner />
  if (error || !contract) return <ErrorAlert message="No se pudo cargar el contrato." onRetry={refetch} />

  const s = STATUS_MAP[contract.contract_status] ?? { label: contract.contract_status, variant: 'gray' as const }

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Personal', to: '/personnel' },
        { label: 'Empleados', to: '/personnel/employees' },
        { label: employee?.full_name ?? '…', to: `/personnel/employees/${employeeId}` },
        { label: 'Contrato' },
      ]} />

      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Contrato</h1>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/personnel/employees/${employeeId}/contracts/${contractId}/edit`)}
            className="btn-primary"
          >
            Editar
          </button>
          <button onClick={() => setShowDelete(true)} className="btn-danger">
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Datos del contrato" />
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label="Tipo de contrato" value={contract.contract_type_name} />
            <InfoRow label="Cargo" value={contract.position_name} />
            <InfoRow label="Ciudad de contratación" value={contract.hiring_city != null ? String(contract.hiring_city) : null} />
            <InfoRow label="Fecha inicio" value={contract.start_date} />
            <InfoRow label="Fecha fin" value={contract.end_date} />
            <InfoRow label="Jornada laboral" value={contract.work_schedule} />
            <InfoRow label="Contrato actual" value={contract.is_current} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Compensación" />
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label="Salario" value={`$${Number(contract.salary).toLocaleString('es-CO')}`} />
            <InfoRow label="Tipo salario" value={contract.salary_type} />
            <InfoRow label="Modalidad pago" value={contract.salary_mode} />
            <InfoRow label="Subsidio transporte" value={contract.transport_allowance} />
            <InfoRow label="Método de pago" value={contract.payment_method} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Datos bancarios" />
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label="Banco" value={contract.bank != null ? String(contract.bank) : null} />
            <InfoRow label="Nº cuenta" value={contract.bank_account_number} />
            <InfoRow label="Tipo cuenta" value={contract.bank_account_type} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Seguridad social" />
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label="EPS" value={contract.eps != null ? String(contract.eps) : null} />
            <InfoRow label="AFP / Fondo pensión" value={contract.afp != null ? String(contract.afp) : null} />
            <InfoRow label="ARL" value={contract.pension_risk != null ? String(contract.pension_risk) : null} />
            <InfoRow label="Caja compensación" value={contract.ccf != null ? String(contract.ccf) : null} />
            <InfoRow label="Fondo cesantías" value={contract.severance_fund != null ? String(contract.severance_fund) : null} />
            <InfoRow label="Tipo cotizante" value={contract.contributor_type} />
            <InfoRow label="Estado SS" value={contract.social_security_status} />
            <InfoRow label="Es pensionado" value={contract.is_pensioner} />
          </dl>
        </Card>

        {contract.notes && (
          <Card className="lg:col-span-2">
            <CardHeader title="Notas" />
            <p className="text-sm text-summa-ink whitespace-pre-wrap">{contract.notes}</p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Eliminar contrato"
        message="¿Eliminar este contrato? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}
