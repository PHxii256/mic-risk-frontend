import { useTranslation } from 'react-i18next'

import type { ReportStatus } from '@/domain/report'
import type { RiskBand } from '@/domain/scoring'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const BAND_CLASSES: Record<RiskBand, string> = {
  Low: 'bg-band-low-bg text-band-low',
  Moderate: 'bg-band-moderate-bg text-band-moderate',
  High: 'bg-band-high-bg text-band-high',
  Critical: 'bg-band-critical-bg text-band-critical',
}

const STATUS_CLASSES: Record<ReportStatus, string> = {
  Submitted: 'text-status-submitted',
  InReview: 'text-status-inreview',
  Resolved: 'text-status-resolved',
}

/**
 * A score with its band. The number and the band label always appear together: the two scales
 * differ (inherent tops out at 25, residual at 125), so a bare number is ambiguous.
 */
export function RiskScore({
  score,
  band,
  className,
}: {
  score: number
  band: RiskBand
  className?: string
}) {
  const { t, i18n } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium',
        BAND_CLASSES[band],
        className,
      )}
      data-numeric
    >
      <span className="font-semibold">{formatNumber(score, i18n.language)}</span>
      <span className="opacity-80">{t(`band.${band}`)}</span>
    </span>
  )
}

export function BandLabel({ band }: { band: RiskBand }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium',
        BAND_CLASSES[band],
      )}
    >
      {t(`band.${band}`)}
    </span>
  )
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        STATUS_CLASSES[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  )
}
