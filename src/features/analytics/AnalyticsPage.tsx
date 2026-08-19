import { FileSpreadsheet, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { DownloadableCard } from '@/components/app/DownloadableCard'
import { StateBoundary } from '@/components/app/StateBoundary'
import { Button, Card, CardBody, Skeleton } from '@/components/ui/primitives'
import type {
  AnalyticsDashboard,
  CountByLabel,
  MatrixCell,
  ResourceEngagementStats,
} from '@/domain/models'
import { RATINGS, riskBand, type RiskBand } from '@/domain/scoring'
import { useDashboard, useEngagementByDepartment, useEngagementStats } from '@/features/admin/hooks'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { downloadWorkbook, type Sheet } from '@/lib/xlsx'

const BAND_CELL: Record<RiskBand, string> = {
  Low: 'bg-band-low-bg text-band-low',
  Moderate: 'bg-band-moderate-bg text-band-moderate',
  High: 'bg-band-high-bg text-band-high',
  Critical: 'bg-band-critical-bg text-band-critical',
}

export function AnalyticsPage() {
  const { t } = useTranslation()
  const dashboard = useDashboard(null, null)
  const byDepartment = useEngagementByDepartment()
  const resourceStats = useEngagementStats()

  function exportWorkbook() {
    const data = dashboard.data
    if (!data) return

    // One sheet per table, which is the whole reason for producing a workbook rather than a CSV.
    const sheets: Sheet[] = [
      {
        name: t('analytics.summary'),
        rows: [
          [t('analytics.metric'), t('analytics.value')],
          [t('analytics.awareness'), data.riskAwarenessPercentage],
          [t('analytics.thisWeek'), data.risksThisWeek],
          [t('analytics.thisMonth'), data.risksThisMonth],
          [t('analytics.avgResolution'), data.averageResolutionHours ?? ''],
          [t('analytics.criticalResidual'), data.criticalResidualRisks],
          [t('analytics.weakControls'), data.weakControls],
          [t('analytics.pendingReview'), data.pendingReview],
          [t('action.overdue'), data.overdueActions],
          [t('action.dueThisWeek'), data.dueThisWeekActions],
        ],
      },
      {
        name: t('analytics.inherentMatrix'),
        rows: [
          [t('scoring.severity'), t('scoring.frequency'), t('analytics.count')],
          ...data.inherentMatrix.map((c) => [c.severity, c.frequency, c.count]),
        ],
      },
      {
        name: t('analytics.residualBands'),
        rows: [
          [t('analytics.band'), t('analytics.count')],
          ...data.residualBands.map((b) => [t(`band.${b.band}`), b.count]),
        ],
      },
      countSheet(t('analytics.byDepartment'), data.risksByDepartment, t),
      countSheet(t('analytics.byLocation'), data.risksByLocation, t),
      countSheet(t('analytics.bySubcategory'), data.subcategoryDistribution, t),
      {
        name: t('analytics.maturity'),
        rows: [
          [t('employee.department'), t('analytics.value')],
          ...data.maturityByDepartment.map((m) => [m.departmentName, m.maturityScore]),
        ],
      },
      {
        name: t('analytics.resourceReach'),
        rows: [
          [
            t('resource.name'),
            t('analytics.type'),
            t('analytics.viewed'),
            t('analytics.eligible'),
            t('analytics.coverage'),
          ],
          ...(resourceStats.data ?? []).map((r) => [
            r.resourceName,
            r.resourceType,
            r.viewCount,
            r.eligibleEmployees,
            r.eligibleEmployees === 0
              ? 0
              : Math.round((r.viewCount / r.eligibleEmployees) * 100),
          ]),
        ],
      },
    ]

    downloadWorkbook(sheets, 'MIC-Risk-Analytics')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-ink">{t('nav.analytics')}</h1>

        {/* Excluded from print: the buttons are not part of the report. */}
        <div className="flex gap-2 print:hidden">
          <Button
            type="button"
            variant="secondary"
            onClick={exportWorkbook}
            disabled={!dashboard.data}
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            {t('analytics.exportExcel')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer className="size-3.5" aria-hidden="true" />
            {t('analytics.print')}
          </Button>
        </div>
      </div>

      <StateBoundary
        isLoading={dashboard.isPending}
        error={dashboard.error}
        data={dashboard.data}
        onRetry={() => void dashboard.refetch()}
        skeleton={
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        {(data) => <Dashboard data={data} />}
      </StateBoundary>

      <DownloadableCard title={t('analytics.resourceReach')}>
        <StateBoundary
          isLoading={resourceStats.isPending}
          error={resourceStats.error}
          data={resourceStats.data}
          onRetry={() => void resourceStats.refetch()}
          skeleton={<Skeleton className="h-40 w-full" />}
          isEmpty={(list) => list.length === 0}
        >
          {(list) => <ResourceReach stats={list} />}
        </StateBoundary>
      </DownloadableCard>

      <DownloadableCard title={t('analytics.engagementByDepartment')}>
        <StateBoundary
          isLoading={byDepartment.isPending}
          error={byDepartment.error}
          data={byDepartment.data}
          onRetry={() => void byDepartment.refetch()}
          skeleton={<Skeleton className="h-40 w-full" />}
          isEmpty={(list) => list.length === 0}
        >
          {(list) => (
            <SimpleBarChart
              data={list.map((d) => ({ label: d.departmentName, count: d.awarenessPercentage }))}
            />
          )}
        </StateBoundary>
      </DownloadableCard>
    </div>
  )
}

/**
 * How far each resource has reached the people it is aimed at. Administrators are excluded
 * server-side from both the numerator and the denominator, so this measures readership rather
 * than headcount.
 */
function ResourceReach({ stats }: { stats: ResourceEngagementStats[] }) {
  const { t, i18n } = useTranslation()

  return (
    <ul className="space-y-2.5">
      {stats.map((resource) => {
        const percentage =
          resource.eligibleEmployees === 0
            ? 0
            : Math.round((resource.viewCount / resource.eligibleEmployees) * 100)

        return (
          <li key={resource.resourceId} className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-ink">{resource.resourceName}</span>
              <span className="text-ink-muted" data-numeric>
                {t('resource.viewedBy', {
                  viewed: formatNumber(resource.viewCount, i18n.language),
                  total: formatNumber(resource.eligibleEmployees, i18n.language),
                })}{' '}
                <span className="text-ink-subtle">({percentage}%)</span>
              </span>
            </div>

            <div className="h-2 w-full rounded-sm bg-surface-muted">
              <div className="h-2 rounded-sm bg-accent" style={{ width: `${percentage}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function countSheet(
  name: string,
  data: CountByLabel[],
  t: (key: string) => string,
): Sheet {
  return {
    name,
    rows: [[t('analytics.label'), t('analytics.count')], ...data.map((d) => [d.label, d.count])],
  }
}

function Dashboard({ data }: { data: AnalyticsDashboard }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t('analytics.awareness')} value={`${data.riskAwarenessPercentage}%`} />
        <Tile label={t('analytics.thisWeek')} value={formatNumber(data.risksThisWeek, i18n.language)} />
        <Tile label={t('analytics.thisMonth')} value={formatNumber(data.risksThisMonth, i18n.language)} />
        <Tile
          label={t('analytics.avgResolution')}
          value={
            data.averageResolutionHours === null
              ? '—'
              : `${formatNumber(Math.round(data.averageResolutionHours), i18n.language)} h`
          }
        />

        <Tile
          label={t('analytics.criticalResidual')}
          value={formatNumber(data.criticalResidualRisks, i18n.language)}
          tone={data.criticalResidualRisks > 0 ? 'danger' : 'neutral'}
        />
        <Tile label={t('analytics.weakControls')} value={formatNumber(data.weakControls, i18n.language)} />
        <Tile label={t('analytics.pendingReview')} value={formatNumber(data.pendingReview, i18n.language)} />
        <Tile
          label={t('action.overdue')}
          value={formatNumber(data.overdueActions, i18n.language)}
          tone={data.overdueActions > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DownloadableCard title={t('analytics.inherentMatrix')}>
          <RiskMatrix cells={data.inherentMatrix} />
        </DownloadableCard>

        <DownloadableCard title={t('analytics.residualBands')} bodyClassName="space-y-2">
          {data.residualBands.map((band) => {
            const total = data.residualBands.reduce((sum, b) => sum + b.count, 0)
            const share = total === 0 ? 0 : (band.count / total) * 100

            return (
              <div key={band.band} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-ink-muted">{t(`band.${band.band}`)}</span>
                  <span data-numeric>{formatNumber(band.count, i18n.language)}</span>
                </div>
                <div className="h-2 w-full rounded-sm bg-surface-muted">
                  <div
                    className={cn('h-2 rounded-sm', BAND_CELL[band.band])}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            )
          })}
        </DownloadableCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t('analytics.byDepartment')} data={data.risksByDepartment} />
        <ChartCard title={t('analytics.byLocation')} data={data.risksByLocation} />
        <ChartCard title={t('analytics.bySubcategory')} data={data.subcategoryDistribution} />
        <ChartCard
          title={t('analytics.maturity')}
          data={data.maturityByDepartment.map((m) => ({
            label: m.departmentName,
            count: m.maturityScore,
          }))}
        />
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'danger'
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-ink-muted">{label}</p>
        <p
          className={cn('mt-1 text-xl font-semibold', tone === 'danger' ? 'text-danger' : 'text-ink')}
          data-numeric
        >
          {value}
        </p>
      </CardBody>
    </Card>
  )
}

/**
 * The 5x5 severity-by-frequency grid, hand-built rather than coerced out of a chart library:
 * Recharts has no real heatmap, and 25 cells are clearer and better-looking as markup.
 */
function RiskMatrix({ cells }: { cells: MatrixCell[] }) {
  const { t, i18n } = useTranslation()

  const lookup = new Map(cells.map((cell) => [`${cell.severity}:${cell.frequency}`, cell.count]))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 text-xs">
        <div />
        {RATINGS.map((frequency) => (
          <div key={`head-${frequency}`} className="text-center text-ink-subtle" data-numeric>
            {frequency}
          </div>
        ))}

        {/* Highest severity on top, so the grid reads like a conventional risk matrix. */}
        {[...RATINGS].reverse().flatMap((severity) => [
          <div key={`label-${severity}`} className="pe-1 text-end text-ink-subtle" data-numeric>
            {severity}
          </div>,
          ...RATINGS.map((frequency) => {
            const count = lookup.get(`${severity}:${frequency}`) ?? 0
            const band = riskBand(severity * frequency)

            return (
              <div
                key={`${severity}-${frequency}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-sm text-sm font-medium',
                  count === 0 ? 'bg-surface-muted text-ink-subtle' : BAND_CELL[band],
                )}
                title={`${t('scoring.severity')} ${severity} · ${t('scoring.frequency')} ${frequency}`}
                data-numeric
              >
                {count === 0 ? '' : formatNumber(count, i18n.language)}
              </div>
            )
          }),
        ])}
      </div>

      <div className="flex justify-between text-xs text-ink-subtle">
        <span>{t('scoring.severity')} ↑</span>
        <span>{t('scoring.frequency')} →</span>
      </div>
    </div>
  )
}

function ChartCard({ title, data }: { title: string; data: CountByLabel[] }) {
  const { t } = useTranslation()

  return (
    <DownloadableCard title={title}>
      {data.length === 0 ? (
        <p className="text-sm text-ink-subtle">{t('state.empty')}</p>
      ) : (
        <SimpleBarChart data={data} />
      )}
    </DownloadableCard>
  )
}

function SimpleBarChart({ data }: { data: CountByLabel[] }) {
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
          {/* Reversed under RTL so categories read in the same direction as the text. */}
          <XAxis
            dataKey="label"
            reversed={isRtl}
            tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            orientation={isRtl ? 'right' : 'left'}
            tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid var(--color-border-subtle)',
            }}
          />
          <Bar dataKey="count" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
