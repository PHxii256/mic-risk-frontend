import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { ApiError } from '@/api/errors'
import { StatusBadge } from '@/components/app/RiskBadge'
import { StateBoundary } from '@/components/app/StateBoundary'
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Skeleton, Spinner } from '@/components/ui/primitives'
import { assignedDepartmentLabel } from '@/domain/assignedDepartments'
import type { RiskReport } from '@/domain/report'
import { formatDateTime } from '@/lib/format'

import { ReportActionsPanel } from '@/features/admin/ReportActions'
import { useIsAdmin } from '@/features/auth/useSession'

import { AssignedDepartmentSelect } from './AssignedDepartmentSelect'
import { EvaluationPanel } from './EvaluationPanel'
import { StatusControl } from './StatusControl'
import { ReminderSettingsPanel } from './ReminderSettingsPanel'
import { useReport, useReportHistory, useUpdateAssignedDepartment } from './hooks/queries'

export function ReportDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const reportId = Number(params.reportId)

  const query = useReport(reportId)

  return (
    <div className="space-y-4">
      <Link
        to="/reports"
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        {/* Mirrors with the writing direction, so it always points back rather than left. */}
        <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        {t('nav.myReports')}
      </Link>

      <StateBoundary
        isLoading={query.isPending}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        skeleton={<DetailSkeleton />}
      >
        {(report) => <ReportDetail report={report} />}
      </StateBoundary>
    </div>
  )
}

function ReportDetail({ report }: { report: RiskReport }) {
  const { t, i18n } = useTranslation()
  const isAdmin = useIsAdmin()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('report.title')} #{report.id}</CardTitle>
          {isAdmin ? <StatusControl report={report} /> : <StatusBadge status={report.status} />}
        </CardHeader>
        <CardBody className="space-y-4">
          <section className="space-y-1">
            <h3 className="text-xs font-medium text-ink-muted">{t('report.cause')}</h3>
            <p className="whitespace-pre-wrap text-sm text-ink">{report.cause}</p>
          </section>

          <section className="space-y-1">
            <h3 className="text-xs font-medium text-ink-muted">{t('report.consequences')}</h3>
            <p className="whitespace-pre-wrap text-sm text-ink">{report.consequences}</p>
          </section>

          <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
            {report.subCategory ? <Detail label={t('report.subcategory')} value={report.subCategory.nameEn} /> : null}
            <Detail
              label={t('report.category')}
              value={t(`riskCategory.${report.category}`)}
            />
            <Detail label={t('report.reporter')} value={report.reporter.name} />
            {isAdmin ? null : (
              <Detail
                label={t('report.assignedDepartment')}
                value={assignedDepartmentLabel(report.assignedDepartment, t)}
              />
            )}
            <Detail
              label={t('report.submittedAt')}
              value={formatDateTime(report.submittedAt, i18n.language)}
            />
            <Detail label={t('report.dueDate')} value={formatDateTime(report.dueDate, i18n.language)} />
          </dl>
        </CardBody>
      </Card>

      {isAdmin ? <AssignedDepartmentPanel report={report} /> : null}

      {isAdmin ? <EvaluationPanel report={report} /> : null}

      {isAdmin ? <ReminderSettingsPanel report={report} /> : null}

      {/* The whole risk-action controller is admin-only, including reads. */}
      {isAdmin ? <ReportActionsPanel reportId={report.id} /> : null}

      <HistoryCard reportId={report.id} />
    </div>
  )
}

function AssignedDepartmentPanel({ report }: { report: RiskReport }) {
  const { t } = useTranslation()
  const update = useUpdateAssignedDepartment(report.id)
  const [value, setValue] = useState(report.assignedDepartment ?? '')

  useEffect(() => {
    setValue(report.assignedDepartment ?? '')
  }, [report.assignedDepartment])

  const current = report.assignedDepartment ?? ''
  const hasChanges = value !== current

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('report.assignedDepartment')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <Field htmlFor="assigned-department" label={t('report.assignedDepartment')}>
          <AssignedDepartmentSelect
            id="assigned-department"
            value={value}
            onChange={setValue}
            disabled={update.isPending}
          />
        </Field>

        {update.isError ? (
          <p className="rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
            {update.error instanceof ApiError ? (update.error.detail ?? t('state.errorTitle')) : t('state.errorTitle')}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!hasChanges || update.isPending}
            onClick={() => update.mutate(value === '' ? null : value)}
          >
            {update.isPending ? <Spinner /> : null}
            {t('common.save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function HistoryCard({ reportId }: { reportId: number }) {
  const { t, i18n } = useTranslation()
  const query = useReportHistory(reportId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('report.history')}</CardTitle>
      </CardHeader>
      <CardBody>
        <StateBoundary
          isLoading={query.isPending}
          error={query.error}
          data={query.data}
          onRetry={() => void query.refetch()}
          skeleton={
            <div className="space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          }
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-ink-subtle">{t('report.noHistory')}</p>}
        >
          {(page) => (
            <ol className="space-y-2">
              {page.items.map((change) => (
                <li key={change.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge status={change.oldStatus} />
                  <span className="text-ink-subtle rtl:rotate-180" aria-hidden="true">
                    →
                  </span>
                  <StatusBadge status={change.newStatus} />
                  <span className="text-ink-subtle">
                    {change.changedBy.name} · {formatDateTime(change.changedAt, i18n.language)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </StateBoundary>
      </CardBody>
    </Card>
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

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardBody className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </CardBody>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardBody className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-full" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardBody>
            <Skeleton className="h-3 w-2/3" />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
