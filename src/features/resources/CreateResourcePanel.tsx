import { ClipboardList, Link2, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Spinner,
  Textarea,
} from '@/components/ui/primitives'
import { Tabs, type TabDefinition } from '@/components/ui/tabs'
import { useCreateLinkResource, useUploadResource } from '@/features/admin/hooks'
import { useCurrentEmployeeId } from '@/features/auth/useSession'

/** Mirrors the server's FileUploadOptions; the request is rejected past either limit. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.mp4', '.mp3', '.av1', '.m4a',
]

type Mode = 'file' | 'link' | 'survey'

/**
 * The three ways a resource comes into existence.
 *
 * Files go through the multipart upload endpoint, which derives the type from the extension.
 * Links, videos and surveys are URL-backed, so they use the plain create endpoint with an
 * explicit type — the values the database check constraint permits.
 */
export function CreateResourcePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('file')

  const tabs: TabDefinition<Mode>[] = [
    { id: 'file', label: t('resource.tabFile') },
    { id: 'link', label: t('resource.tabLink') },
    { id: 'survey', label: t('resource.tabSurvey') },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('resource.addTitle')}</CardTitle>
        <Tabs tabs={tabs} active={mode} onChange={setMode} />
      </CardHeader>
      <CardBody>
        {mode === 'file' ? <FileForm onClose={onClose} /> : null}
        {mode === 'link' ? <LinkForm onClose={onClose} kind="link" /> : null}
        {mode === 'survey' ? <LinkForm onClose={onClose} kind="survey" /> : null}
      </CardBody>
    </Card>
  )
}

function FileForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const upload = useUploadResource()

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  /** Preflight before the request, so an oversized file fails instantly rather than after upload. */
  function validate(candidate: File): string | null {
    const dot = candidate.name.lastIndexOf('.')
    const extension = dot === -1 ? '' : candidate.name.slice(dot).toLowerCase()

    if (!ALLOWED_EXTENSIONS.includes(extension)) return t('resource.badType')
    if (candidate.size > MAX_UPLOAD_BYTES) return t('resource.tooLarge')
    return null
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!file) return

        const problem = validate(file)
        if (problem) {
          setLocalError(problem)
          return
        }

        upload.mutate({ file, name, description }, { onSuccess: onClose })
      }}
    >
      <Field htmlFor="res-file" label={t('resource.file')} hint={t('resource.fileHint')} required>
        <Input
          id="res-file"
          type="file"
          aria-required="true"
          onChange={(event) => {
            const picked = event.currentTarget.files?.[0] ?? null
            setFile(picked)
            setLocalError(picked ? validate(picked) : null)
            if (picked && !name) setName(picked.name)
          }}
        />
      </Field>

      <Field htmlFor="res-name" label={t('resource.name')} required>
        <Input
          id="res-name"
          value={name}
          aria-required="true"
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </Field>

      <div className="sm:col-span-2">
        <Field
          htmlFor="res-description"
          label={t('resource.description')}
          optionalLabel={t('form.optional')}
        >
          <Textarea
            id="res-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
        </Field>
      </div>

      <FormFooter
        error={localError ?? errorText(upload.error, t)}
        pending={upload.isPending}
        disabled={!file || localError !== null}
        submitLabel={t('resource.upload')}
        icon={<Upload className="size-3.5" aria-hidden="true" />}
        onClose={onClose}
      />
    </form>
  )
}

function LinkForm({ onClose, kind }: { onClose: () => void; kind: 'link' | 'survey' }) {
  const { t } = useTranslation()
  const create = useCreateLinkResource()
  const employeeId = useCurrentEmployeeId()

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')

  /**
   * The database constrains the type to Video, Image, File, Quiz or Link. A survey is stored as
   * Quiz, which is also what the engagement analytics counts.
   */
  function resolveType(candidate: string): string {
    if (kind === 'survey') return 'Quiz'
    return /youtube\.com|youtu\.be|vimeo\.com|\.mp4($|\?)/i.test(candidate) ? 'Video' : 'Link'
  }

  const detectedType = resolveType(url)

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (employeeId === null) return

        create.mutate(
          {
            name,
            uploadedByEmpId: employeeId,
            url,
            type: detectedType,
            description: description ? description : null,
          },
          { onSuccess: onClose },
        )
      }}
    >
      <Field htmlFor="link-name" label={t('resource.name')} required>
        <Input
          id="link-name"
          value={name}
          aria-required="true"
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </Field>

      <Field
        htmlFor="link-url"
        label={kind === 'survey' ? t('resource.surveyUrl') : t('resource.url')}
        hint={kind === 'survey' ? t('resource.surveyHint') : t('resource.urlHint')}
        required
      >
        <Input
          id="link-url"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          aria-required="true"
          onChange={(e) => setUrl(e.currentTarget.value)}
        />
      </Field>

      <div className="sm:col-span-2">
        <Field
          htmlFor="link-description"
          label={t('resource.description')}
          optionalLabel={t('form.optional')}
        >
          <Textarea
            id="link-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
        </Field>
      </div>

      {url ? (
        <p className="text-xs text-ink-subtle sm:col-span-2">
          {t('resource.detectedType')}: <strong>{detectedType}</strong>
        </p>
      ) : null}

      <FormFooter
        error={errorText(create.error, t)}
        pending={create.isPending}
        disabled={!url || !name || employeeId === null}
        submitLabel={t('common.save')}
        icon={
          kind === 'survey' ? (
            <ClipboardList className="size-3.5" aria-hidden="true" />
          ) : (
            <Link2 className="size-3.5" aria-hidden="true" />
          )
        }
        onClose={onClose}
      />
    </form>
  )
}

function FormFooter({
  error,
  pending,
  disabled,
  submitLabel,
  icon,
  onClose,
}: {
  error: string | null
  pending: boolean
  disabled: boolean
  submitLabel: string
  icon: React.ReactNode
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      {error ? (
        <p className="rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending || disabled}>
          {pending ? <Spinner /> : icon}
          {submitLabel}
        </Button>
      </div>
    </>
  )
}

function errorText(error: unknown, t: (key: string) => string): string | null {
  if (!error) return null
  if (error instanceof ApiError) return error.detail ?? t('state.errorTitle')
  return t('state.errorTitle')
}
