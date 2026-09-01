import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { HeadRow, Row, TableShell, TableSkeleton, Td, Th } from '@/components/app/DataTable'
import { StateBoundary } from '@/components/app/StateBoundary'
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Spinner, Textarea } from '@/components/ui/primitives'
import type { EmailReminderTemplate } from '@/domain/models'

import { useDeleteEmailReminderTemplate, useEmailReminderTemplates, useSaveEmailReminderTemplate } from './hooks'

export function EmailTemplatesPage() {
  const { t } = useTranslation()
  const templates = useEmailReminderTemplates()
  const remove = useDeleteEmailReminderTemplate()
  const [editing, setEditing] = useState<EmailReminderTemplate | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-ink">{t('emailTemplate.title')}</h1>
        <Button type="button" onClick={() => setEditing('new')}>
          <Plus className="size-3.5" aria-hidden="true" />{t('emailTemplate.add')}
        </Button>
      </div>

      {editing ? <TemplateForm template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}

      <Card>
        <CardBody className="text-xs text-ink-muted">
          {t('emailTemplate.placeholders', {
            placeholders:
              '{{riskId}}, {{category}}, {{cause}}, {{consequences}}, {{assignedDepartment}}, {{dueDate}}, {{status}}, {{ownerEmail}}, {{reportUrl}}',
          })}
        </CardBody>
      </Card>

      <StateBoundary
        isLoading={templates.isPending}
        error={templates.error}
        data={templates.data}
        onRetry={() => void templates.refetch()}
        skeleton={<TableSkeleton columns={4} />}
        isEmpty={(items) => items.length === 0}
      >
        {(items) => (
          <TableShell>
            <HeadRow><Th>{t('emailTemplate.name')}</Th><Th>{t('emailTemplate.subject')}</Th><Th>{t('emailTemplate.body')}</Th><Th /></HeadRow>
            <tbody>
              {items.map((template) => (
                <Row key={template.id}>
                  <Td className="font-medium">{template.name}</Td>
                  <Td>{template.subject}</Td>
                  <Td className="max-w-md truncate text-ink-muted">{template.body}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(template)}>
                        <Pencil className="size-3.5" aria-hidden="true" />{t('common.edit')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={remove.isPending} onClick={() => {
                        if (confirm(t('emailTemplate.confirmDelete'))) remove.mutate(template.id)
                      }}>
                        <Trash2 className="size-3.5" aria-hidden="true" />{t('common.delete')}
                      </Button>
                    </div>
                  </Td>
                </Row>
              ))}
            </tbody>
          </TableShell>
        )}
      </StateBoundary>
    </div>
  )
}

function TemplateForm({ template, onClose }: { template?: EmailReminderTemplate; onClose: () => void }) {
  const { t } = useTranslation()
  const save = useSaveEmailReminderTemplate()
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')

  return (
    <Card>
      <CardHeader><CardTitle>{template ? t('emailTemplate.edit') : t('emailTemplate.add')}</CardTitle></CardHeader>
      <CardBody>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault()
          save.mutate({ id: template?.id, name, subject, body }, { onSuccess: onClose })
        }}>
          <Field htmlFor="template-name" label={t('emailTemplate.name')} required>
            <Input id="template-name" value={name} required onChange={(event) => setName(event.currentTarget.value)} />
          </Field>
          <Field htmlFor="template-subject" label={t('emailTemplate.subject')} required>
            <Input id="template-subject" value={subject} required onChange={(event) => setSubject(event.currentTarget.value)} />
          </Field>
          <Field htmlFor="template-body" label={t('emailTemplate.body')} required>
            <Textarea id="template-body" rows={8} value={body} required onChange={(event) => setBody(event.currentTarget.value)} />
          </Field>
          {save.isError ? <p className="rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
            {save.error instanceof ApiError ? (save.error.detail ?? t('state.errorTitle')) : t('state.errorTitle')}
          </p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!name.trim() || !subject.trim() || !body.trim() || save.isPending}>
              {save.isPending ? <Spinner /> : null}{t('common.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

export function EmailTemplatesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('emailTemplate.title')}
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-4xl rounded-md border border-border-subtle bg-canvas p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
        <EmailTemplatesPage />
      </div>
    </div>
  )
}
