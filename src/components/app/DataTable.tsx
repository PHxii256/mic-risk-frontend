import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Card, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      {/* Wide tables scroll inside their own container so the page body never scrolls sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">{children}</table>
      </div>
    </Card>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn('px-3 py-2 text-start text-xs font-medium text-ink-muted', className)}>
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2 align-middle', className)}>{children}</td>
}

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border-subtle bg-surface-muted">{children}</tr>
    </thead>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-surface-muted">
      {children}
    </tr>
  )
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  onChange,
  isFetching,
}: {
  page: number
  totalPages: number
  totalCount: number
  onChange: (page: number) => void
  isFetching?: boolean
}) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-ink-muted">
      <span data-numeric>
        {t('common.page')} {page} {t('common.of')} {totalPages} · {totalCount}
      </span>

      <div className="flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => onChange(page - 1)}
        >
          {t('common.previous')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => onChange(page + 1)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}

/** Placeholder shaped like the table it stands in for, rather than a generic spinner. */
export function TableSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border-subtle bg-surface-muted px-3 py-2">
        <Skeleton className="h-3 w-40" />
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border-subtle px-3 py-2.5 last:border-0"
        >
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton key={colIndex} className={cn('h-3', colIndex === 0 ? 'flex-1' : 'w-20')} />
          ))}
        </div>
      ))}
    </Card>
  )
}
