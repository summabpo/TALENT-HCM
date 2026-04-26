import Badge from '@/components/ui/Badge'
import type { SyncStatus } from '@/types'

const LABELS: Record<SyncStatus, string> = {
  never: 'Sin sincronizar',
  success: 'Exitosa',
  error: 'Error',
  running: 'En progreso',
}

const VARIANTS: Record<SyncStatus, 'gray' | 'green' | 'red' | 'yellow'> = {
  never: 'gray',
  success: 'green',
  error: 'red',
  running: 'yellow',
}

interface Props {
  status: SyncStatus
}

export default function SyncStatusBadge({ status }: Props) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
}
