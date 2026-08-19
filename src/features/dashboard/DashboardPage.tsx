import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { HeadRow, Row, TableShell, TableSkeleton, Td, Th } from '@/components/app/DataTable'
import { RiskScore, StatusBadge } from '@/components/app/RiskBadge'
import { EmptyState, StateBoundary } from '@/components/app/StateBoundary'
import { Card, CardBody, Skeleton } from '@/components/ui/primitives'
import { useAllReports, useDashboard } from '@/features/admin/hooks'
import { useSession } from '@/features/auth/useSession'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The admin landing screen: who you are, what needs attention, and the newest reports.
 *
 * Deliberately a summary rather than a second analytics page — the headline numbers plus a way
 * into the work, with the full breakdowns one click away.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const session = useSession()

  const analytics = useDashboard(null, null)
  // The queue is ordered newest-first by the server, so page one is the recent activity.
  const recent = useAllReports(null, 1)

  const firstName = session?.employee.name.split(' ')[0] ?? ''

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ink">
          {t('dashboard.greeting', { name: firstName })}
        </h1>
        <p className="text-sm text-ink-muted">{t('dashboard.subtitle')}</p>
      </div>

      <StateBoundary
        isLoading={analytics.isPending}
        error={analytics.error}
        data={analytics.data}
        onRetry={() => void analytics.refetch()}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        }
      >
        {(data) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label={t('analytics.pendingReview')}
              value={data.pendingReview}
              tone={data.pendingReview > 0 ? 'attention' : 'neutral'}
            />
            <Tile
              label={t('analytics.criticalResidual')}
              value={data.criticalResidualRisks}
              tone={data.criticalResidualRisks > 0 ? 'danger' : 'neutral'}
            />
            <Tile
              label={t('action.overdue')}
              value={data.overdueActions}
              tone={data.overdueActions > 0 ? 'danger' : 'neutral'}
            />
            <Tile label={t('analytics.thisWeek')} value={data.risksThisWeek} />
          </div>
        )}
      </StateBoundary>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t('dashboard.recentReports')}</h2>
          <Link
            to="/admin/reports"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            {t('dashboard.viewAll')}
            {/* Mirrors with the writing direction. */}
            <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>

        <StateBoundary
          isLoading={recent.isPending}
          error={recent.error}
          data={recent.data}
          onRetry={() => void recent.refetch()}
          skeleton={<TableSkeleton columns={5} rows={5} />}
          isEmpty={(result) => result.items.length === 0}
          empty={<EmptyState message={t('dashboard.noReports')} />}
        >
          {(result) => (
            <TableShell>
              <HeadRow>
                <Th>{t('report.description')}</Th>
                <Th>{t('report.reporter')}</Th>
                <Th>{t('scoring.residualRisk')}</Th>
                <Th>{t('report.status')}</Th>
                <Th>{t('report.submittedAt')}</Th>
              </HeadRow>
              <tbody>
                {result.items.slice(0, 8).map((report) => (
                  <Row key={report.id}>
                    <Td>
                      <Link
                        to={`/reports/${report.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {truncate(report.description)}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted">{report.reporter.name}</Td>
                    <Td>
                      <RiskScore
                        score={report.effectiveEvaluation.residualRisk}
                        band={report.effectiveEvaluation.residualBand}
                      />
                    </Td>
                    <Td>
                      <StatusBadge status={report.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {formatDate(report.submittedAt, i18n.language)}
                    </Td>
                  </Row>
                ))}
              </tbody>
            </TableShell>
          )}
        </StateBoundary>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink to="/admin/reports" label={t('nav.allReports')} />
        <QuickLink to="/admin/analytics" label={t('nav.analytics')} />
        <QuickLink to="/reports/new" label={t('nav.submitReport')} />
      </section>
    </div>
  )
}

function Tile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'attention' | 'danger'
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-ink-muted">{label}</p>
        <p
          className={cn(
            'mt-1 text-xl font-semibold',
            tone === 'danger' && 'text-danger',
            tone === 'attention' && 'text-band-moderate',
            tone === 'neutral' && 'text-ink',
          )}
          data-numeric
        >
          {value}
        </p>
      </CardBody>
    </Card>
  )
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm text-ink transition-colors hover:bg-surface-muted"
    >
      {label}
      <ArrowRight className="size-4 text-ink-subtle rtl:rotate-180" aria-hidden="true" />
    </Link>
  )
}

function truncate(text: string, max = 60): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`
}
