import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { HeadRow, Pagination, Row, TableShell, TableSkeleton, Td } from '@/components/app/DataTable'
import { RiskScore, StatusBadge } from '@/components/app/RiskBadge'
import { EmptyState, StateBoundary } from '@/components/app/StateBoundary'
import { Button, Input, Select } from '@/components/ui/primitives'
import { REPORT_STATUSES, type ReportStatus } from '@/domain/report'
import { useAllReports } from '@/features/admin/hooks'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Column keys the server knows how to sort by. */
const SORTABLE = [
  'submittedAt',
  'reporter',
  'subcategory',
  'inherentRisk',
  'residualRisk',
  'status',
] as const
type SortKey = (typeof SORTABLE)[number]

/**
 * The admin triage queue.
 *
 * Filter, search, sort and page all live in the URL, so a particular view can be linked and
 * survives a reload — and all of them are applied by the server, so they span every report
 * rather than reordering the twenty already on screen.
 */
export function AllReportsPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()

  const statusParam = params.get('status')
  const status = REPORT_STATUSES.includes(statusParam as ReportStatus)
    ? (statusParam as ReportStatus)
    : null
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const search = params.get('q') ?? ''
  const sortByParam = params.get('sortBy')
  const sortBy: SortKey = SORTABLE.includes(sortByParam as SortKey)
    ? (sortByParam as SortKey)
    : 'submittedAt'
  const sortDir: 'asc' | 'desc' = params.get('sortDir') === 'asc' ? 'asc' : 'desc'

  // Typing is debounced into the URL so each keystroke does not become a request.
  const [draft, setDraft] = useState(search)
  useEffect(() => setDraft(search), [search])

  useEffect(() => {
    if (draft === search) return

    const timer = setTimeout(() => update({ q: draft || null }), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const query = useAllReports(status, page, search, sortBy, sortDir)

  function update(next: {
    status?: string | null
    q?: string | null
    page?: number
    sortBy?: SortKey
    sortDir?: 'asc' | 'desc'
  }) {
    const draftParams = new URLSearchParams(params)

    for (const [key, value] of Object.entries({
      status: next.status,
      q: next.q,
      sortBy: next.sortBy,
      sortDir: next.sortDir,
    })) {
      if (value === undefined) continue
      if (value) draftParams.set(key, String(value))
      else draftParams.delete(key)
    }

    // Anything that changes the result set invalidates the current page number.
    if (next.status !== undefined || next.q !== undefined || next.sortBy !== undefined) {
      draftParams.delete('page')
    }

    if (next.page !== undefined) draftParams.set('page', String(next.page))

    setParams(draftParams)
  }

  /** Clicking the active column flips direction; a new column starts descending. */
  function toggleSort(key: SortKey) {
    if (key === sortBy) {
      update({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      update({ sortBy: key, sortDir: 'desc' })
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-ink">{t('nav.allReports')}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-2 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder={t('report.searchPlaceholder')}
            aria-label={t('report.searchPlaceholder')}
            className="ps-7"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-ink-muted">
          {t('report.status')}
          <Select
            className="w-36"
            value={status ?? ''}
            onChange={(event) => update({ status: event.currentTarget.value || null })}
          >
            <option value="">{t('report.allStatuses')}</option>
            {REPORT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </Select>
        </label>

        <Button
          type="button"
          variant="secondary"
          onClick={() => update({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })}
          title={t(sortDir === 'asc' ? 'report.sortAscending' : 'report.sortDescending')}
        >
          {sortDir === 'asc' ? (
            <ArrowUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden="true" />
          )}
          {t(sortDir === 'asc' ? 'report.sortAscending' : 'report.sortDescending')}
        </Button>

        {search || status ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => update({ q: null, status: null })}
          >
            <X className="size-3.5" aria-hidden="true" />
            {t('report.clearFilters')}
          </Button>
        ) : null}
      </div>

      <StateBoundary
        isLoading={query.isPending}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        skeleton={<TableSkeleton columns={7} />}
        isEmpty={(result) => result.items.length === 0}
        empty={<EmptyState message={t('report.noReportsMatch')} />}
      >
        {(result) => (
          <div>
            <TableShell>
              <HeadRow>
                <SortableTh label={t('report.description')} />
                <SortableTh
                  label={t('report.reporter')}
                  sortKey="reporter"
                  active={sortBy}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('report.subcategory')}
                  sortKey="subcategory"
                  active={sortBy}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('scoring.inherentRisk')}
                  sortKey="inherentRisk"
                  active={sortBy}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('scoring.residualRisk')}
                  sortKey="residualRisk"
                  active={sortBy}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('report.status')}
                  sortKey="status"
                  active={sortBy}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('report.submittedAt')}
                  sortKey="submittedAt"
                  active={sortBy}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </HeadRow>
              <tbody>
                {result.items.map((report) => (
                  <Row key={report.id}>
                    <Td>
                      <Link
                        to={`/reports/${report.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {truncate(report.description)}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {report.reporter.name}
                      <span className="block text-xs text-ink-subtle">
                        {report.reporter.department.name}
                      </span>
                    </Td>
                    <Td className="text-ink-muted">{report.subCategory.name}</Td>
                    <Td>
                      <RiskScore
                        score={report.effectiveEvaluation.inherentRisk}
                        band={report.effectiveEvaluation.inherentBand}
                      />
                    </Td>
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

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              totalCount={result.totalCount}
              isFetching={query.isFetching}
              onChange={(next) => update({ page: next })}
            />
          </div>
        )}
      </StateBoundary>
    </div>
  )
}

function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string
  sortKey?: SortKey
  active?: SortKey
  dir?: 'asc' | 'desc'
  onSort?: (key: SortKey) => void
}) {
  // The description column has no server-side sort, so it stays a plain header.
  if (!sortKey || !onSort) {
    return <th className="px-3 py-2 text-start text-xs font-medium text-ink-muted">{label}</th>
  }

  const isActive = active === sortKey

  return (
    <th className="px-3 py-2 text-start text-xs font-medium text-ink-muted">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'inline-flex items-center gap-1 hover:text-ink',
          isActive && 'font-semibold text-ink',
        )}
      >
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )
        ) : null}
      </button>
    </th>
  )
}

function truncate(text: string, max = 60): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`
}
