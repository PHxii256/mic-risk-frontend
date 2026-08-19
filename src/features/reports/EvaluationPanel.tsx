import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { RiskScore } from '@/components/app/RiskBadge'
import { Button, Card, CardBody, CardHeader, CardTitle, Spinner } from '@/components/ui/primitives'
import { Tabs, type TabDefinition } from '@/components/ui/tabs'
import { useIsAdmin } from '@/features/auth/useSession'
import type { Evaluation, RiskReport } from '@/domain/report'
import {
  CONTROL_EFFECTIVENESS_KEYS,
  FREQUENCY_KEYS,
  PRIORITY_KEYS,
  SEVERITY_KEYS,
  type Rating,
} from '@/domain/scoring'
import { formatDateTime } from '@/lib/format'

import { EvaluationFields } from './evaluationFields'
import { evaluationSchema, UNSET_PRIORITY, type EvaluationValues } from './evaluationSchema'
import { useSaveAuditorEvaluation } from './hooks/queries'

type TabId = 'reporter' | 'auditor'

/**
 * The report's assessments, as one card with a tab per evaluation.
 *
 * The reporter's evaluation is a record of what was reported and is never editable. The
 * auditor's is the risk department's own assessment: it starts as a copy of the reporter's and
 * can be revised afterwards, with the card showing who last revised it.
 */
export function EvaluationPanel({ report }: { report: RiskReport }) {
  const { t, i18n } = useTranslation()
  const isAdmin = useIsAdmin()

  const hasAuditor = report.auditorEvaluation !== null
  const [active, setActive] = useState<TabId>(hasAuditor ? 'auditor' : 'reporter')
  const [editing, setEditing] = useState(false)

  // An auditor evaluation that appears while the panel is open (this admin just created it, or
  // a refetch brought one in) should become the visible tab rather than staying hidden.
  useEffect(() => {
    if (hasAuditor) setActive('auditor')
  }, [hasAuditor])

  const tabs: TabDefinition<TabId>[] = [
    { id: 'reporter', label: t('report.reporterTab') },
    ...(hasAuditor ? [{ id: 'auditor' as const, label: t('report.auditorTab') }] : []),
  ]

  const startCreating = () => {
    setActive('auditor')
    setEditing(true)
  }

  const showingAuditorForm = editing && isAdmin
  const auditorEvaluation = report.auditorEvaluation

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('report.evaluation')}</CardTitle>

        <div className="flex items-center gap-2">
          {/* Sits where the tabs live even when there is only one, so the header does not jump. */}
          <Tabs tabs={tabs} active={active} onChange={setActive} />
        </div>
      </CardHeader>

      <CardBody className="space-y-3">
        {active === 'reporter' ? (
          <>
            <EvaluationView evaluation={report.reportedEvaluation} />

            {isAdmin && !hasAuditor ? (
              <div className="border-t border-border-subtle pt-3">
                <p className="mb-2 text-xs text-ink-muted">{t('report.noAuditorEvaluation')}</p>
                <Button type="button" variant="secondary" onClick={startCreating}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t('report.addAuditorEvaluation')}
                </Button>
              </div>
            ) : null}
          </>
        ) : showingAuditorForm ? (
          <AuditorEvaluationForm
            report={report}
            onDone={() => setEditing(false)}
            onCancel={() => {
              setEditing(false)
              if (!hasAuditor) setActive('reporter')
            }}
          />
        ) : auditorEvaluation ? (
          <>
            <p className="text-xs text-ink-subtle">
              {t('report.lastModifiedBy', {
                name: auditorEvaluation.evaluator.name,
                when: formatDateTime(auditorEvaluation.evaluatedAt, i18n.language),
              })}
            </p>

            <EvaluationView evaluation={auditorEvaluation} />

            {isAdmin ? (
              <div className="border-t border-border-subtle pt-3">
                <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  {t('report.reviseEvaluation')}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </CardBody>
    </Card>
  )
}

function EvaluationView({ evaluation }: { evaluation: Evaluation }) {
  const { t, i18n } = useTranslation()
  const isAdmin = useIsAdmin()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-ink-muted">{t('scoring.inherentRisk')}</p>
          <div className="mt-1">
            <RiskScore score={evaluation.inherentRisk} band={evaluation.inherentBand} />
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('scoring.residualRisk')}</p>
          <div className="mt-1">
            <RiskScore score={evaluation.residualRisk} band={evaluation.residualBand} />
          </div>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <Detail
          label={t('scoring.severity')}
          value={ratingLabel(evaluation.severity, SEVERITY_KEYS, t)}
        />
        <Detail
          label={t('scoring.frequency')}
          value={ratingLabel(evaluation.frequency, FREQUENCY_KEYS, t)}
        />
        <Detail
          label={t('scoring.controlEffectiveness')}
          value={ratingLabel(evaluation.controlEffectiveness, CONTROL_EFFECTIVENESS_KEYS, t)}
        />
        {/* Priority is the risk department's judgement, so only they see it. */}
        {isAdmin ? (
          <Detail
            label={t('scoring.priority')}
            value={ratingLabel(evaluation.priority, PRIORITY_KEYS, t)}
          />
        ) : null}
      </dl>

      {evaluation.existingMeasures ? (
        <Detail label={t('report.existingMeasures')} value={evaluation.existingMeasures} />
      ) : null}
      {evaluation.proposedMeasures ? (
        <Detail label={t('report.proposedMeasures')} value={evaluation.proposedMeasures} />
      ) : null}

      <p className="text-xs text-ink-subtle">
        {evaluation.evaluator.name} · {formatDateTime(evaluation.evaluatedAt, i18n.language)}
      </p>
    </div>
  )
}

function AuditorEvaluationForm({
  report,
  onDone,
  onCancel,
}: {
  report: RiskReport
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveAuditorEvaluation()

  const existing = report.auditorEvaluation
  const mode = existing ? 'revise' : 'create'

  // A new auditor evaluation opens as a copy of the reporter's, so the auditor adjusts an
  // assessment rather than starting from nothing.
  const source = existing ?? report.reportedEvaluation

  const { control, register, handleSubmit } = useForm<EvaluationValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      severity: source.severity,
      frequency: source.frequency,
      controlEffectiveness: source.controlEffectiveness,
      priority: existing ? source.priority : UNSET_PRIORITY,
      existingMeasures: source.existingMeasures ?? '',
      proposedMeasures: source.proposedMeasures ?? '',
    },
  })

  function onSubmit(values: EvaluationValues) {
    const parsed = evaluationSchema.parse(values)

    save.mutate(
      {
        mode,
        input: {
          reportId: report.id,
          severity: parsed.severity,
          frequency: parsed.frequency,
          controlEffectiveness: parsed.controlEffectiveness,
          priority: parsed.priority,
          existingMeasures: parsed.existingMeasures ? parsed.existingMeasures : null,
          proposedMeasures: parsed.proposedMeasures ? parsed.proposedMeasures : null,
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {mode === 'create' ? (
        <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs text-ink-muted">
          {t('report.copiedFromReporter')}
        </p>
      ) : null}

      <EvaluationFields control={control} register={register} showPriority />

      {save.isError ? (
        <p className="rounded-sm bg-danger-bg px-3 py-2 text-xs text-danger" role="alert">
          {save.error instanceof ApiError
            ? (save.error.detail ?? t('state.errorTitle'))
            : t('state.errorTitle')}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? (
            <>
              <Spinner />
              {t('report.saving')}
            </>
          ) : (
            t('report.saveEvaluation')
          )}
        </Button>
      </div>
    </form>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-ink">{value}</dd>
    </div>
  )
}

function ratingLabel(
  value: number,
  keys: Record<Rating, string>,
  t: (key: string) => string,
): string {
  const key = keys[value as Rating]
  return key ? `${value} — ${t(key)}` : String(value)
}
