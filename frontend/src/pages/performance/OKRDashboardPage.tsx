import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { performanceApi } from '@/api/performance'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorAlert from '@/components/ui/ErrorAlert'
import ProgressBar from '@/components/ui/ProgressBar'
import Badge from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { Objective, KeyResult } from '@/types'

const LEVEL_LABELS: Record<string, string> = {
  company: 'Empresa', department: 'Área', individual: 'Individual',
}

const STATUS_MAP: Record<string, { label: string; variant: 'gray' | 'green' | 'navy' | 'magenta' }> = {
  draft: { label: 'Borrador', variant: 'gray' },
  active: { label: 'Activo', variant: 'navy' },
  completed: { label: 'Completado', variant: 'green' },
  cancelled: { label: 'Cancelado', variant: 'magenta' },
}

function KeyResultRow({ kr }: { kr: KeyResult }) {
  const [showUpdate, setShowUpdate] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [comment, setComment] = useState('')
  const qc = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: () => performanceApi.postKRUpdate(kr.id, {
      new_value: newValue,
      updated_by: 'usuario',
      comment,
    }),
    onSuccess: () => {
      setShowUpdate(false)
      setNewValue('')
      setComment('')
      qc.invalidateQueries({ queryKey: ['period-objectives'] })
    },
  })

  return (
    <div className="ml-6 py-2 border-l-2 border-summa-border pl-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-summa-ink">{kr.title}</p>
          <div className="mt-1 flex items-center gap-4">
            <ProgressBar value={kr.progress_percentage} size="sm" />
            <span className="text-xs text-summa-ink-light whitespace-nowrap">
              {kr.current_value} / {kr.target_value} {kr.metric_type}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowUpdate(!showUpdate)}
          className="flex-shrink-0 text-xs text-summa-navy hover:text-summa-magenta font-semibold transition-colors"
        >
          Actualizar
        </button>
      </div>

      {showUpdate && (
        <div className="mt-2 flex items-end gap-2">
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Nuevo valor"
            className="input w-28"
          />
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentario"
            className="input flex-1"
          />
          <button
            disabled={!newValue || updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
            className="btn-primary btn-sm disabled:opacity-50"
          >
            {updateMutation.isPending ? '…' : 'Guardar'}
          </button>
          <button onClick={() => setShowUpdate(false)} className="text-xs text-summa-ink-light hover:text-summa-ink">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function ObjectiveCard({ obj }: { obj: Objective }) {
  const [expanded, setExpanded] = useState(false)
  const s = STATUS_MAP[obj.status] ?? { label: obj.status, variant: 'gray' as const }

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 hover:bg-summa-surface transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-summa-ink-light uppercase tracking-wide">
                {LEVEL_LABELS[obj.level] ?? obj.level}
              </span>
              <Badge variant={s.variant}>{s.label}</Badge>
            </div>
            <p className="font-semibold text-summa-ink text-sm">{obj.title}</p>
            <div className="mt-2">
              <ProgressBar value={obj.progress_percentage} size="sm" />
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-summa-ink-light">{obj.key_results.length} KR</p>
            <span className={`text-summa-ink-light text-sm transition-transform inline-block ${expanded ? 'rotate-180' : ''}`}>▼</span>
          </div>
        </div>
      </button>

      {expanded && obj.key_results.length > 0 && (
        <div className="border-t border-summa-border px-4 py-2 space-y-1">
          {obj.key_results.map((kr) => (
            <KeyResultRow key={kr.id} kr={kr} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OKRDashboardPage() {
  const { periodId } = useParams<{ periodId: string }>()

  const { data: period } = useQuery({
    queryKey: ['okr-period', periodId],
    queryFn: () => performanceApi.period(periodId!),
    enabled: !!periodId,
  })

  const { data: objectives, isLoading, error, refetch } = useQuery({
    queryKey: ['period-objectives', periodId],
    queryFn: () => performanceApi.periodObjectives(periodId!),
    enabled: !!periodId,
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert message="Error al cargar los objetivos." onRetry={refetch} />

  const objs: Objective[] = objectives ?? []
  const byLevel: Record<string, Objective[]> = {}
  objs.forEach(o => { (byLevel[o.level] = byLevel[o.level] ?? []).push(o) })

  const avgProgress = objs.length > 0
    ? Math.round(objs.reduce((s, o) => s + o.progress_percentage, 0) / objs.length)
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Desempeño', to: '/performance' },
        { label: 'Periodos', to: '/performance/periods' },
        { label: period?.name ?? '…' },
      ]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">{period?.name}</h1>
          {period && <p className="text-sm text-summa-ink-light mt-1">{period.start_date} → {period.end_date}</p>}
        </div>
        <button
          onClick={() => {/* TODO: open create objective form */}}
          className="btn-primary"
        >
          + Nuevo objetivo
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Objetivos', value: objs.length },
          { label: 'Progreso promedio', value: `${avgProgress}%` },
          { label: 'Completados', value: objs.filter(o => o.status === 'completed').length },
        ].map(({ label, value }) => (
          <Card key={label} className="text-center">
            <p className="text-2xl font-bold text-summa-ink">{value}</p>
            <p className="text-xs text-summa-ink-light mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {objs.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-summa-ink">Progreso del periodo</span>
            <span className="text-sm font-bold text-summa-navy">{avgProgress}%</span>
          </div>
          <ProgressBar value={avgProgress} showLabel={false} />
        </Card>
      )}

      {(['company', 'department', 'individual'] as const).map((level) => {
        const items = byLevel[level]
        if (!items || items.length === 0) return null
        return (
          <div key={level}>
            <h2 className="text-xs font-semibold text-summa-ink-light uppercase tracking-widest mb-3">
              {LEVEL_LABELS[level]}
            </h2>
            <div className="space-y-2">
              {items.map((obj) => <ObjectiveCard key={obj.id} obj={obj} />)}
            </div>
          </div>
        )
      })}

      {objs.length === 0 && (
        <div className="card p-12 text-center text-sm text-summa-ink-light">
          No hay objetivos en este periodo.
        </div>
      )}
    </div>
  )
}
