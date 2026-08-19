import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { TableSkeleton } from '@/components/app/DataTable'
import { StateBoundary } from '@/components/app/StateBoundary'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui/primitives'
import { ACTION_STATUSES, type RiskAction } from '@/domain/models'
import { formatDate } from '@/lib/format'

import { useCurrentEmployeeId } from '@/features/auth/useSession'

import { useActionsByReport, useDeleteAction, useSaveAction } from './hooks'

/**
 * Mitigations live on the report they belong to rather than in a separate queue, so an auditor
 * records them in the same place they read the assessment. Each one is owned by the admin who
 * raises it, so there is no assignee to choose.
 */
export function ReportActionsPanel({ reportId }: { reportId: number }) {
  const { t, i18n } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<RiskAction | null>(null)

  const actions = useActionsByReport(reportId, true)
  const remove = useDeleteAction()

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('action.heading')}</CardTitle>
        <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" aria-hidden="true" />
          {t('action.add')}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {adding ? <ActionForm reportId={reportId} onClose={() => setAdding(false)} /> : null}
        {editing ? <ActionForm action={editing} onClose={() => setEditing(null)} /> : null}

        <StateBoundary
          isLoading={actions.isPending}
          error={actions.error}
          data={actions.data}
          onRetry={() => void actions.refetch()}
          skeleton={<TableSkeleton columns={4} rows={2} />}
          isEmpty={(list) => list.length === 0}
          empty={<p className="text-sm text-ink-subtle">{t('action.none')}</p>}
        >
          {(list) => (
            <ul className="space-y-2">
              {list.map((action) => (
                <li
                  key={action.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-xs text-ink-subtle">
                      {action.assignee.name} · {formatDate(action.dueDate, i18n.language)}
                      {action.isOverdue ? ` · ${t('action.overdue')}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={
                        action.status === 'Completed'
                          ? 'text-xs font-medium text-band-low'
                          : 'text-xs font-medium text-band-moderate'
                      }
                    >
                      {t(`actionStatus.${action.status}`)}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(action)}>
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(t('action.confirmDelete'))) remove.mutate(action.id)
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </StateBoundary>
      </CardBody>
    </Card>
  )
}

function ActionForm({
  action,
  reportId,
  onClose,
}: {
  action?: RiskAction
  reportId?: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveAction()
  const currentEmployeeId = useCurrentEmployeeId()

  const [title, setTitle] = useState(action?.title ?? '')
  const [description, setDescription] = useState(action?.description ?? '')
  const [dueDate, setDueDate] = useState(
    action ? toDateInput(action.dueDate) : toDateInput(new Date()),
  )
  const [status, setStatus] = useState(action?.status ?? 'Pending')

  const targetReportId = action?.reportId ?? reportId

  // A new mitigation belongs to the admin raising it. An existing one keeps its owner, so
  // editing someone else's does not quietly transfer it to whoever opened the form.
  const assigneeEmpId = action?.assignee.id ?? currentEmployeeId

  return (
    <Card>
      <CardHeader>
        <CardTitle>{action ? t('action.edit') : t('action.add')}</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (targetReportId === undefined || assigneeEmpId === null) return

            save.mutate(
              {
                id: action?.id,
                reportId: targetReportId,
                title,
                description: description ? description : null,
                assigneeEmpId,
                // Midday local avoids a date-only value landing on the previous day once it is
                // converted to UTC for the wire.
                dueDate: new Date(`${dueDate}T12:00:00`).toISOString(),
                status,
              },
              { onSuccess: onClose },
            )
          }}
        >
          <Field htmlFor="action-title" label={t('action.title')} required>
            <Input
              id="action-title"
              value={title}
              aria-required="true"
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </Field>

          <Field htmlFor="action-due" label={t('action.dueDate')} required>
            <Input
              id="action-due"
              type="date"
              value={dueDate}
              aria-required="true"
              onChange={(e) => setDueDate(e.currentTarget.value)}
            />
          </Field>

          {action ? (
            <Field htmlFor="action-status" label={t('report.status')}>
              <Select
                id="action-status"
                value={status}
                onChange={(e) => setStatus(e.currentTarget.value as typeof status)}
              >
                {ACTION_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`actionStatus.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <div className="sm:col-span-2">
            <Field
              htmlFor="action-description"
              label={t('action.description')}
              optionalLabel={t('form.optional')}
            >
              <Textarea
                id="action-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </Field>
          </div>

          {save.isError ? (
            <p className="rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger sm:col-span-2" role="alert">
              {save.error instanceof ApiError
                ? (save.error.detail ?? t('state.errorTitle'))
                : t('state.errorTitle')}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

/** Local calendar date, not UTC — otherwise the picker can show yesterday west of Greenwich. */
function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
