import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Select, Spinner } from '@/components/ui/primitives'
import type { RiskReport } from '@/domain/report'
import { useEmailReminderTemplates } from '@/features/admin/hooks'
import { useIsAdmin } from '@/features/auth/useSession'

import { useUpdateReminderSettings } from './hooks/queries'

export function ReminderSettingsPanel({ report }: { report: RiskReport }) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const templates = useEmailReminderTemplates({ enabled: isAdmin })
  const update = useUpdateReminderSettings(report.id)
  const [dueDate, setDueDate] = useState(toDateInput(report.dueDate))
  const [owners, setOwners] = useState(report.ownerEmails.length ? report.ownerEmails : ['@mohins.com'])
  const [enabled, setEnabled] = useState(report.sendReminderEmails)
  const [templateId, setTemplateId] = useState(report.reminderTemplateId ? String(report.reminderTemplateId) : '')

  useEffect(() => {
    setDueDate(toDateInput(report.dueDate))
    setOwners(report.ownerEmails.length ? report.ownerEmails : ['@mohins.com'])
    setEnabled(report.sendReminderEmails)
    setTemplateId(report.reminderTemplateId ? String(report.reminderTemplateId) : '')
  }, [report])

  const validOwners = owners.map((email) => email.trim()).filter((email) => /^\S+@\S+\.\S+$/.test(email))

  return (
    <Card>
      <CardHeader><CardTitle>{t('report.reminderSettings')}</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <Field htmlFor="report-due-date" label={t('report.dueDate')} required>
          <Input id="report-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} />
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-muted">{t('report.riskOwners')}</p>
          {owners.map((email, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="email"
                value={email}
                aria-label={t('report.riskOwnerNumber', { number: index + 1 })}
                onChange={(event) => setOwners((current) => current.map((value, ownerIndex) => ownerIndex === index ? event.currentTarget.value : value))}
              />
              {owners.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" aria-label={t('report.removeOwner')} onClick={() => setOwners((current) => current.filter((_, ownerIndex) => ownerIndex !== index))}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => setOwners((current) => [...current, '@mohins.com'])}>
            <Plus className="size-3.5" aria-hidden="true" /> {t('report.addOwner')}
          </Button>
        </div>

        {isAdmin ? (
          <Field htmlFor="report-reminder-template" label={t('emailTemplate.template')} optionalLabel={t('form.optional')}>
            <Select id="report-reminder-template" value={templateId} onChange={(event) => setTemplateId(event.currentTarget.value)}>
              <option value="">{t('emailTemplate.defaultTemplate')}</option>
              {templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </Select>
          </Field>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-accent" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
          {t('report.sendOverdueReminders')}
        </label>

        {update.isError ? (
          <p className="rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
            {update.error instanceof ApiError ? (update.error.detail ?? t('state.errorTitle')) : t('state.errorTitle')}
          </p>
        ) : null}
        {update.isSuccess ? <p className="text-xs text-band-low" role="status">{t('report.reminderSettingsSaved')}</p> : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!dueDate || validOwners.length !== owners.length || validOwners.length === 0 || update.isPending}
            onClick={() => update.mutate({
              dueDate: new Date(`${dueDate}T23:59:59`).toISOString(),
              ownerEmails: validOwners,
              sendReminderEmails: enabled,
              reminderTemplateId: isAdmin ? (templateId ? Number(templateId) : null) : report.reminderTemplateId,
            })}
          >
            {update.isPending ? <Spinner /> : null}{t('common.save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
