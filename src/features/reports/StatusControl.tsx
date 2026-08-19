import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { StatusBadge } from '@/components/app/RiskBadge'
import { Button, Spinner } from '@/components/ui/primitives'
import { allowedTransitions, type ReportStatus, type RiskReport } from '@/domain/report'
import { useUpdateReportStatus } from '@/features/admin/hooks'

/**
 * Moves a report through its lifecycle.
 *
 * Only the transitions the server accepts are offered — the graph is mirrored in
 * `allowedTransitions`, and anything outside it comes back as a 400 the user cannot act on.
 * Notably `Resolved` reopens only to `InReview`, never straight back to `Submitted`.
 */
export function StatusControl({ report }: { report: RiskReport }) {
  const { t } = useTranslation()
  const update = useUpdateReportStatus(report.id)

  const targets = allowedTransitions(report.status).filter((next) => next !== report.status)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={report.status} />

      {targets.length > 0 ? (
        <>
          <span className="text-xs text-ink-subtle">{t('report.moveTo')}</span>

          {targets.map((target) => (
            <Button
              key={target}
              type="button"
              variant="secondary"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate(target as ReportStatus)}
            >
              {update.isPending ? <Spinner /> : null}
              {t(`status.${target}`)}
            </Button>
          ))}
        </>
      ) : null}

      {update.isError ? (
        <span className="text-xs text-danger" role="alert">
          {update.error instanceof ApiError
            ? (update.error.detail ?? t('state.errorTitle'))
            : t('state.errorTitle')}
        </span>
      ) : null}
    </div>
  )
}
