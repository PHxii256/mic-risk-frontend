import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { Select, Spinner } from '@/components/ui/primitives'
import { REPORT_STATUSES, type ReportStatus, type RiskReport } from '@/domain/report'
import { useActionsByReport, useUpdateReportStatus } from '@/features/admin/hooks'

/**
 * Moves a report through its lifecycle.
 *
 * Every lifecycle state is visible in one select. Resolution is guarded in both the UI and API:
 * at least one mitigation must exist before the report can be marked resolved.
 */
export function StatusControl({ report }: { report: RiskReport }) {
  const { t } = useTranslation()
  const update = useUpdateReportStatus(report.id)
  const actions = useActionsByReport(report.id, true)
  const [guardMessage, setGuardMessage] = useState<string | null>(null)

  const hasMitigation = (actions.data?.length ?? 0) > 0

  function changeStatus(nextStatus: ReportStatus) {
    if (nextStatus === report.status) return

    if (nextStatus === 'Resolved' && !hasMitigation) {
      setGuardMessage(t('report.mitigationRequired'))
      return
    }

    setGuardMessage(null)
    update.mutate(nextStatus)
  }

  return (
    <div className="flex max-w-sm flex-col items-stretch gap-1.5">
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        {t('report.status')}
        <Select
          value={report.status}
          disabled={update.isPending || actions.isPending}
          aria-label={t('report.status')}
          onChange={(event) => changeStatus(event.currentTarget.value as ReportStatus)}
        >
          {REPORT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </Select>
        {update.isPending ? <Spinner /> : null}
      </label>

      {!actions.isPending && !hasMitigation && !guardMessage && !update.isError ? (
        <span className="text-xs text-ink-subtle">{t('report.mitigationRequired')}</span>
      ) : null}

      {guardMessage || update.isError ? (
        <span className="rounded-sm bg-danger-bg px-2 py-1 text-xs text-danger" role="alert">
          {guardMessage ??
            (update.error instanceof ApiError
              ? (update.error.detail ?? t('state.errorTitle'))
              : t('state.errorTitle'))}
        </span>
      ) : null}
    </div>
  )
}
